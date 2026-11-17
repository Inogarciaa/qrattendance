const express = require("express");
const { admin } = require("../lib/supabase");
const { toEmail, buildPassword, toBirthdate } = require("../lib/password");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isLocalMode } = require("../lib/mode");
const { listAccounts } = require("../lib/local-db");
const { hasApprovalColumn, hasTempOrganizerTables, hasOfficerGroupTables } = require("../lib/schema");
const { organizerGrantExpiry } = require("../lib/clock");
const { getEvent } = require("../services/attendance");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

async function programMap() {
  const { data, error } = await admin.from("programs").select("id, code");
  if (error) throw error;
  const byCode = {};
  for (const p of data || []) byCode[p.code.toUpperCase()] = p.id;
  return byCode;
}

async function importUsers(rows, role) {
  const byCode = await programMap();
  const results = { created: [], failed: [] };

  for (const row of rows || []) {
    const { school_id, full_name } = row;
    if (!school_id || !full_name) {
      results.failed.push({ school_id, error: "school_id and full_name are required" });
      continue;
    }

    let password;
    try {
      password = buildPassword(school_id, row.birthdate);
    } catch {
      results.failed.push({ school_id, error: "valid birthdate is required" });
      continue;
    }

    const email = toEmail(school_id);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { school_id: String(school_id), full_name, role },
    });

    if (createError) {
      results.failed.push({ school_id, error: createError.message });
      continue;
    }

    const programId = row.program_id
      ?? (row.program_code ? byCode[String(row.program_code).toUpperCase()] : null)
      ?? null;

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: created.user.id,
        school_id: String(school_id),
        full_name,
        email,
        role,
        program_id: programId,
        year_level: row.year_level ?? null,
        birthdate: toBirthdate(row.birthdate),
        photo_url: row.photo_url ?? null,
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      results.failed.push({ school_id, error: profileError.message });
      continue;
    }

    results.created.push({ school_id: String(school_id), id: created.user.id });
  }

  return results;
}

router.post("/import/students", async (req, res) => {
  if (isLocalMode) {
    return res.status(501).json({ error: "Import is not available in local mode" });
  }
  const results = await importUsers(req.body?.rows, "student");
  res.json(results);
});

router.post("/import/organizers", async (req, res) => {
  if (isLocalMode) {
    return res.status(501).json({ error: "Import is not available in local mode" });
  }
  const results = await importUsers(req.body?.rows, "organizer");
  res.json(results);
});

router.get("/organizers", async (req, res) => {
  if (isLocalMode) {
    return res.json({
      organizers: listAccounts("organizer").map((account) => ({
        id: account.id,
        school_id: account.school_id,
        full_name: account.full_name,
        program: account.program
          ? { id: account.program.id, code: account.program.code, name: account.program.name }
          : null,
      })),
    });
  }

  const { data, error } = await admin
    .from("profiles")
    .select("id, school_id, full_name, program:programs(id, code, name)")
    .eq("role", "organizer")
    .eq("is_active", true)
    .order("full_name");
  if (error) throw error;
  res.json({ organizers: data });
});

router.get("/students", async (req, res) => {
  const { q, program_id, status } = req.query;

  if (isLocalMode) {
    let students = listAccounts("student").map((account) => ({
      id: account.id,
      school_id: account.school_id,
      full_name: account.full_name,
      email: account.email,
      year_level: null,
      photo_url: null,
      is_active: account.is_active,
      program: account.program
        ? { id: account.program.id, code: account.program.code, name: account.program.name }
        : null,
    }));
    if (program_id) {
      students = students.filter((student) => String(student.program?.id) === String(program_id));
    }
    if (q) {
      const needle = String(q).toLowerCase();
      students = students.filter(
        (student) =>
          student.full_name.toLowerCase().includes(needle) ||
          student.school_id.toLowerCase().includes(needle) ||
          String(student.email || "").toLowerCase().includes(needle)
      );
    }
    return res.json({ students, approvals_enabled: false });
  }

  const withApproval = await hasApprovalColumn();
  const columns =
    "id, school_id, full_name, email, year_level, photo_url, is_active, program:programs(id, code, name)";

  let query = admin
    .from("profiles")
    .select(withApproval ? `${columns}, approved_at` : columns)
    .eq("role", "student")
    .order("full_name");

  if (withApproval && status === "pending") query = query.is("approved_at", null);
  if (withApproval && status === "active") query = query.not("approved_at", "is", null);

  if (program_id) query = query.eq("program_id", program_id);
  if (q) {
    const term = String(q).replace(/[%,()]/g, "");
    query = query.or(
      `full_name.ilike.%${term}%,school_id.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  res.json({ students: data, approvals_enabled: withApproval });
});

/**
 * The approval queue: every self-signed-up account, student or organizer,
 * that an admin has not accepted yet.
 */
router.get("/approvals", async (req, res) => {
  if (isLocalMode) {
    return res.json({ approvals: [], approvals_enabled: false });
  }

  const withApproval = await hasApprovalColumn();
  if (!withApproval) {
    return res.json({ approvals: [], approvals_enabled: false });
  }

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, school_id, full_name, email, role, year_level, photo_url, created_at, program:programs(id, code, name)"
    )
    .in("role", ["student", "organizer"])
    .is("approved_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  res.json({ approvals: data || [], approvals_enabled: true });
});

const APPROVABLE_ROLES = ["student", "organizer"];

/**
 * Approves a self-signed-up student or organizer, or rejects (deletes) one that
 * is still pending. The admin can correct the role and department in the same
 * call, because people do pick the wrong button.
 */
router.patch("/accounts/:id/approval", async (req, res) => {
  if (isLocalMode) {
    return res.status(501).json({ error: "Approval is not available in local mode" });
  }
  if (!(await hasApprovalColumn())) {
    return res.status(503).json({
      error: "Approvals need migration 0005_signup_approval.sql",
      code: "migration_required",
    });
  }

  const approved = Boolean(req.body?.approved);
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, role, approved_at")
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return res.status(404).json({ error: "Account not found" });
  if (!APPROVABLE_ROLES.includes(profile.role)) {
    return res.status(400).json({ error: "Staff accounts are not approved here" });
  }

  if (!approved) {
    if (profile.approved_at) {
      return res
        .status(409)
        .json({ error: "This account is already approved. Disable it instead." });
    }
    // Deleting the auth user also removes the profile through the FK cascade.
    const { error: deleteError } = await admin.auth.admin.deleteUser(profile.id);
    if (deleteError) throw deleteError;
    return res.json({ deleted: true });
  }

  const changes = { is_active: true, approved_at: new Date().toISOString() };

  if (req.body?.role !== undefined) {
    const role = String(req.body.role).trim().toLowerCase();
    if (!APPROVABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: "role must be student or organizer" });
    }
    changes.role = role;
  }

  if (req.body?.program_id !== undefined) {
    const programId = req.body.program_id === null ? null : Number(req.body.program_id);
    if (programId !== null && !Number.isInteger(programId)) {
      return res.status(400).json({ error: "program_id must be a number or null" });
    }
    if (programId !== null) {
      const { data: program, error: programError } = await admin
        .from("programs")
        .select("id")
        .eq("id", programId)
        .maybeSingle();
      if (programError) throw programError;
      if (!program) return res.status(400).json({ error: "Unknown program/department" });
    }
    changes.program_id = programId;
  }

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update(changes)
    .eq("id", profile.id)
    .select("id, school_id, full_name, email, role, is_active, approved_at")
    .single();
  if (updateError) throw updateError;

  res.json({ account: updated });
});

router.get("/students/:id/attendance", async (req, res) => {
  if (isLocalMode) {
    return res.json({ attendance: [], tally: { present: 0, late: 0, absent: 0 } });
  }

  const { data, error } = await admin
    .from("attendance")
    .select("id, status, method, scanned_at, event:events(id, name, event_date, venue)")
    .eq("student_id", req.params.id)
    .order("scanned_at", { ascending: false });
  if (error) throw error;

  const tally = { present: 0, late: 0, absent: 0 };
  for (const row of data || []) tally[row.status] = (tally[row.status] || 0) + 1;

  res.json({ attendance: data, tally });
});

/* -------------------------------------- temporary organizer access (0008) */

async function tempTablesReady(res) {
  if (isLocalMode) {
    res.status(501).json({ error: "Temporary organizer access needs Supabase mode" });
    return false;
  }
  if (!(await hasTempOrganizerTables())) {
    res.status(503).json({
      error: "Temporary organizer access needs migration 0008_temp_organizers.sql",
      code: "migration_required",
    });
    return false;
  }
  return true;
}

/** Active grants for one event, for the event panel on the dashboard. */
router.get("/events/:id/temp-organizers", async (req, res) => {
  if (!(await tempTablesReady(res))) return;

  const { data, error } = await admin
    .from("event_temp_organizers")
    .select(
      "expires_at, created_at, profile:profiles!profile_id(id, school_id, full_name, photo_url, program:programs(id, code, name))"
    )
    .eq("event_id", req.params.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  res.json({ organizers: data || [] });
});

/** Direct grant, used when the admin already knows who will run the scanner. */
router.post("/events/:id/temp-organizers", async (req, res) => {
  if (!(await tempTablesReady(res))) return;

  const profileId = req.body?.profile_id;
  if (!profileId) return res.status(400).json({ error: "profile_id is required" });

  const event = await getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return res.status(404).json({ error: "Student not found" });
  if (profile.role !== "student") {
    return res.status(400).json({ error: "Temporary gatekeepers must be student accounts" });
  }
  if (!profile.is_active) return res.status(400).json({ error: "That account is not active" });

  const expiresAt = organizerGrantExpiry(event);
  if (!expiresAt) {
    return res.status(400).json({ error: "Set the event date and end time before granting access" });
  }

  const { error: grantError } = await admin.from("event_temp_organizers").upsert(
    {
      event_id: event.id,
      profile_id: profile.id,
      expires_at: expiresAt.toISOString(),
      granted_by: req.user.id,
    },
    { onConflict: "event_id,profile_id" }
  );
  if (grantError) throw grantError;

  res.status(201).json({
    organizer: {
      profile_id: profile.id,
      full_name: profile.full_name,
      expires_at: expiresAt.toISOString(),
    },
  });
});

router.delete("/events/:id/temp-organizers/:profileId", async (req, res) => {
  if (!(await tempTablesReady(res))) return;

  const { error } = await admin
    .from("event_temp_organizers")
    .delete()
    .eq("event_id", req.params.id)
    .eq("profile_id", req.params.profileId);
  if (error) throw error;

  res.json({ ok: true });
});

/* ------------------------------------------- saved officer groups (0009) */

async function groupsReady(res) {
  if (isLocalMode) {
    res.status(501).json({ error: "Saved officer groups need Supabase mode" });
    return false;
  }
  if (!(await hasOfficerGroupTables())) {
    res.status(503).json({
      error: "Saved officer groups need migration 0009_officer_groups.sql",
      code: "migration_required",
    });
    return false;
  }
  return true;
}

/**
 * Only active student accounts can be members, because membership becomes a
 * temporary organizer grant. Unknown or non-student ids are dropped instead of
 * failing the whole save.
 */
async function studentIdsOnly(ids) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  if (!unique.length) return [];

  const { data, error } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .in("id", unique);
  if (error) throw error;

  const allowed = new Set(
    (data || [])
      .filter((row) => row.role === "student" && row.is_active)
      .map((row) => row.id)
  );
  return unique.filter((id) => allowed.has(id));
}

const GROUP_MEMBER_FIELDS =
  "id, school_id, full_name, photo_url, program:programs(id, code, name)";

async function loadGroup(groupId) {
  const { data, error } = await admin
    .from("officer_groups")
    .select(
      `id, name, note, created_at, members:officer_group_members(profile:profiles!profile_id(${GROUP_MEMBER_FIELDS}))`
    )
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    members: (data.members || [])
      .map((row) => row.profile)
      .filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
  };
}

router.get("/officer-groups", async (req, res) => {
  if (!(await groupsReady(res))) return;

  const { data, error } = await admin
    .from("officer_groups")
    .select(
      `id, name, note, created_at, members:officer_group_members(profile:profiles!profile_id(${GROUP_MEMBER_FIELDS}))`
    )
    .order("name", { ascending: true });
  if (error) throw error;

  const groups = (data || []).map((group) => ({
    ...group,
    members: (group.members || [])
      .map((row) => row.profile)
      .filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
  }));

  res.json({ groups });
});

router.post("/officer-groups", async (req, res) => {
  if (!(await groupsReady(res))) return;

  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "name is required" });

  const memberIds = await studentIdsOnly(req.body?.profile_ids);

  const { data: group, error } = await admin
    .from("officer_groups")
    .insert({
      name,
      note: req.body?.note ? String(req.body.note).trim() : null,
      created_by: req.user.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "A group with that name already exists" });
    }
    throw error;
  }

  if (memberIds.length) {
    const { error: memberError } = await admin
      .from("officer_group_members")
      .insert(memberIds.map((profile_id) => ({ group_id: group.id, profile_id })));
    if (memberError) throw memberError;
  }

  res.status(201).json({ group: await loadGroup(group.id) });
});

router.put("/officer-groups/:id", async (req, res) => {
  if (!(await groupsReady(res))) return;

  const patch = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: "name cannot be empty" });
    patch.name = name;
  }
  if (req.body?.note !== undefined) {
    patch.note = req.body.note ? String(req.body.note).trim() : null;
  }

  // PostgREST rejects an empty update payload, so a members-only PUT skips it.
  if (Object.keys(patch).length) {
    const { error } = await admin.from("officer_groups").update(patch).eq("id", req.params.id);
    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "A group with that name already exists" });
      }
      throw error;
    }
  }

  if (Array.isArray(req.body?.profile_ids)) {
    const memberIds = await studentIdsOnly(req.body.profile_ids);
    const { error: clearError } = await admin
      .from("officer_group_members")
      .delete()
      .eq("group_id", req.params.id);
    if (clearError) throw clearError;

    if (memberIds.length) {
      const { error: memberError } = await admin
        .from("officer_group_members")
        .insert(memberIds.map((profile_id) => ({ group_id: req.params.id, profile_id })));
      if (memberError) throw memberError;
    }
  }

  const group = await loadGroup(req.params.id);
  if (!group) return res.status(404).json({ error: "Group not found" });
  res.json({ group });
});

router.delete("/officer-groups/:id", async (req, res) => {
  if (!(await groupsReady(res))) return;

  const { error } = await admin.from("officer_groups").delete().eq("id", req.params.id);
  if (error) throw error;

  res.json({ ok: true });
});

/**
 * Adds every active student member of a group as a temporary gatekeeper for one
 * event. Membership is copied, not linked: editing the group later leaves this
 * event alone, and the usual event-end expiry applies.
 */
router.post("/events/:id/temp-organizers/group", async (req, res) => {
  if (!(await tempTablesReady(res))) return;

  const groupId = req.body?.group_id;
  if (!groupId) return res.status(400).json({ error: "group_id is required" });

  const event = await getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });

  const expiresAt = organizerGrantExpiry(event);
  if (!expiresAt) {
    return res.status(400).json({ error: "Set the event date and end time before granting access" });
  }

  const { data: group, error: groupError } = await admin
    .from("officer_groups")
    .select("id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) return res.status(404).json({ error: "Group not found" });

  const { data: members, error: memberError } = await admin
    .from("officer_group_members")
    .select("profile:profiles!profile_id(id, role, is_active)")
    .eq("group_id", groupId);
  if (memberError) throw memberError;

  const eligible = (members || [])
    .map((row) => row.profile)
    .filter((profile) => profile && profile.role === "student" && profile.is_active)
    .map((profile) => profile.id);

  if (!eligible.length) {
    return res.status(400).json({ error: "That group has no active student members" });
  }

  const { error: grantError } = await admin.from("event_temp_organizers").upsert(
    eligible.map((profile_id) => ({
      event_id: event.id,
      profile_id,
      expires_at: expiresAt.toISOString(),
      granted_by: req.user.id,
    })),
    { onConflict: "event_id,profile_id" }
  );
  if (grantError) throw grantError;

  res.status(201).json({
    group: { id: group.id, name: group.name },
    granted: eligible.length,
    expires_at: expiresAt.toISOString(),
  });
});

/** Student requests waiting for a decision. */
router.get("/organizer-requests", async (req, res) => {
  if (!(await tempTablesReady(res))) return;

  const status = String(req.query.status || "pending");
  const { data, error } = await admin
    .from("organizer_requests")
    .select(
      "id, note, status, created_at, decided_at, event:events(id, name, venue, event_date, start_time, end_time, status), profile:profiles!profile_id(id, school_id, full_name, photo_url, program:programs(id, code, name))"
    )
    .eq("status", status)
    .order("created_at", { ascending: true });
  if (error) throw error;

  res.json({ requests: data || [] });
});

/**
 * Approving creates the same time-boxed grant as a manual assignment. Nothing
 * about the student's role changes, so their own QR keeps working.
 */
router.patch("/organizer-requests/:id", async (req, res) => {
  if (!(await tempTablesReady(res))) return;

  const approved = Boolean(req.body?.approved);
  const { data: request, error } = await admin
    .from("organizer_requests")
    .select("id, event_id, profile_id, status")
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "pending") {
    return res.status(409).json({ error: "This request was already decided." });
  }

  let expiresAt = null;
  if (approved) {
    const event = await getEvent(request.event_id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const expiry = organizerGrantExpiry(event);
    if (!expiry) {
      return res.status(400).json({ error: "That event has no valid date and end time" });
    }
    expiresAt = expiry.toISOString();

    const { error: grantError } = await admin.from("event_temp_organizers").upsert(
      {
        event_id: event.id,
        profile_id: request.profile_id,
        expires_at: expiresAt,
        granted_by: req.user.id,
      },
      { onConflict: "event_id,profile_id" }
    );
    if (grantError) throw grantError;
  }

  const { data: updated, error: updateError } = await admin
    .from("organizer_requests")
    .update({
      status: approved ? "approved" : "declined",
      decided_by: req.user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .select()
    .single();
  if (updateError) throw updateError;

  res.json({ request: updated, expires_at: expiresAt });
});

module.exports = router;
