const express = require("express");
const { admin } = require("../lib/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isLocalMode } = require("../lib/mode");
const { isLiveWindow, organizerGrantExpiry } = require("../lib/clock");
const { parseGeoInput } = require("../lib/geo");
const { hasGeofenceColumns, hasTempOrganizerTables } = require("../lib/schema");
const { getEvent, findGrant } = require("../services/attendance");
const { writeAudit } = require("../lib/audit");
const localDb = require("../lib/local-db");

const router = express.Router();

/** Pending/approved gatekeeper requests for the signed-in student. */
async function myOrganizerRequests(user) {
  if (user.role !== "student" || !(await hasTempOrganizerTables())) return [];

  const { data, error } = await admin
    .from("organizer_requests")
    .select("id, event_id, status, created_at")
    .eq("profile_id", user.id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

const EVENT_FIELDS =
  "id, name, description, venue, event_date, start_time, end_time, grace_minutes, scan_mode, status, qr_window_seconds, created_by, created_at";

/** Migration 0006 columns; only selected once the SQL has been applied. */
const GEO_FIELDS = "latitude, longitude, geofence_radius_m";

async function eventFields() {
  return (await hasGeofenceColumns()) ? `${EVENT_FIELDS}, ${GEO_FIELDS}` : EVENT_FIELDS;
}

function programIdsOf(event) {
  return (event.event_audiences || [])
    .map((row) => row.program_id ?? row.program?.id)
    .filter((id) => id !== null && id !== undefined);
}

/**
 * Who may read one event: staff, an assigned organizer, a student in the
 * audience (no audience rows = all programs), or an active temporary
 * gatekeeper. Used by GET /events/:id; the service role otherwise bypasses RLS.
 */
function canViewEvent(user, event, grant = null) {
  if (user.role === "admin" || user.role === "superadmin") return true;

  const organizerIds = (event.event_organizers || [])
    .map((row) => row.profile_id ?? row.profile?.id)
    .filter(Boolean);
  if (organizerIds.includes(user.id)) return true;

  const programIds = programIdsOf(event);
  if (
    user.role === "student" &&
    (programIds.length === 0 || programIds.includes(user.program_id))
  ) {
    return true;
  }

  return Boolean(grant);
}

async function attendanceTally(eventId) {
  const { data, error } = await admin
    .from("attendance")
    .select("status")
    .eq("event_id", eventId);
  if (error) throw error;

  const tally = { present: 0, late: 0, absent: 0 };
  for (const row of data || []) tally[row.status] = (tally[row.status] || 0) + 1;
  return tally;
}

async function audienceSize(programIds) {
  let query = admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "student")
    .eq("is_active", true)
    .is("deleted_at", null);
  if (programIds.length) query = query.in("program_id", programIds);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

/**
 * Adds the fields the mobile app needs to render an event card: live flag,
 * attendance tally and the enrolled audience size.
 */
async function decorateWithCounts(events) {
  const now = new Date();
  return Promise.all(
    events.map(async (event) => {
      const programIds = programIdsOf(event);
      const [tally, enrolled] = await Promise.all([
        attendanceTally(event.id),
        audienceSize(programIds),
      ]);
      return {
        ...event,
        live: isLiveWindow(event, now),
        tally,
        enrolled,
      };
    })
  );
}

function decorateLocal(event) {
  const now = new Date();
  const programIds = (event.event_audiences || [])
    .map((row) => row.program_id)
    .filter((id) => id !== null && id !== undefined);
  const students = localDb.listAccounts("student");
  const enrolled = programIds.length
    ? students.filter((student) => programIds.includes(student.program?.id)).length
    : students.length;

  return {
    ...event,
    live: isLiveWindow(event, now),
    tally: { present: 0, late: 0, absent: 0 },
    enrolled,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const withCounts = String(req.query.with_counts || "") === "1";
  const organizing = String(req.query.scope || "") === "organizing";

  if (isLocalMode) {
    if (organizing) return res.json({ events: [] });
    const events = localDb.listEvents();
    return res.json({
      events: withCounts ? events.map(decorateLocal) : events,
      my_requests: [],
    });
  }

  // Events this account can run the scanner for. Works for students because
  // temporary organizer access is stored per event, not on profiles.role.
  if (organizing) {
    if (!(await hasTempOrganizerTables())) return res.json({ events: [] });

    const { data, error } = await admin
      .from("event_temp_organizers")
      .select(`expires_at, event:events!inner(${await eventFields()})`)
      .eq("profile_id", req.user.id)
      .gt("expires_at", new Date().toISOString())
      .is("event.deleted_at", null)
      .order("expires_at", { ascending: true });
    if (error) throw error;

    const events = (data || [])
      .filter((row) => row.event)
      .map((row) => ({
        ...row.event,
        live: isLiveWindow(row.event),
        grant_expires_at: row.expires_at,
      }));
    return res.json({ events });
  }

  let query = admin.from("events").select(`${await eventFields()}, event_organizers(profile_id), event_audiences(program_id)`).is("deleted_at", null).order("event_date", { ascending: false });

  if (req.user.role === "organizer") {
    query = admin
      .from("events")
      .select(`${await eventFields()}, event_organizers!inner(profile_id), event_audiences(program_id)`)
      .eq("event_organizers.profile_id", req.user.id)
      .is("deleted_at", null)
      .order("event_date", { ascending: false });
  } else if (req.user.role === "student") {
    // No !inner: an event without audience rows is open to every program and
    // must still reach the student. The program filter runs after the fetch.
    query = admin
      .from("events")
      .select(`${await eventFields()}, event_organizers(profile_id), event_audiences(program_id)`)
      .is("deleted_at", null)
      .order("event_date", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  let events = data || [];
  if (req.user.role === "student") {
    events = events.filter((event) => {
      const programIds = (event.event_audiences || []).map((row) => row.program_id);
      return programIds.length === 0 || programIds.includes(req.user.program_id);
    });
  }

  const decorated = withCounts ? await decorateWithCounts(events) : events;
  const requests = await myOrganizerRequests(req.user);
  res.json({ events: decorated, my_requests: requests });
});

/**
 * A student asks to work the scanner for one event. Approval creates a
 * time-boxed grant; it never changes their role.
 */
router.post("/:id/organizer-request", requireAuth, requireRole("student"), async (req, res) => {
  if (isLocalMode) {
    return res.status(501).json({ error: "Organizer requests need Supabase mode" });
  }
  if (!(await hasTempOrganizerTables())) {
    return res.status(503).json({
      error: "Temporary organizer access needs migration 0008_temp_organizers.sql",
      code: "migration_required",
    });
  }

  const event = await getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (["completed", "cancelled"].includes(event.status)) {
    return res.status(409).json({ error: "This event is already closed." });
  }

  const grant = await findGrant(req.user.id, event.id);
  if (grant) {
    return res.status(409).json({
      error: "You already have gatekeeper access for this event.",
      expires_at: grant.expires_at,
    });
  }

  const note = String(req.body?.note || "").trim().slice(0, 280) || null;
  const { data, error } = await admin
    .from("organizer_requests")
    .insert({ event_id: event.id, profile_id: req.user.id, note })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "You already asked to organize this event. Wait for the admin." });
    }
    throw error;
  }

  res.status(201).json({ request: data });
});

router.delete("/:id/organizer-request", requireAuth, requireRole("student"), async (req, res) => {
  if (isLocalMode) {
    return res.status(501).json({ error: "Organizer requests need Supabase mode" });
  }
  if (!(await hasTempOrganizerTables())) return res.json({ ok: true });

  await admin
    .from("organizer_requests")
    .delete()
    .eq("event_id", req.params.id)
    .eq("profile_id", req.user.id)
    .eq("status", "pending");
  res.json({ ok: true });
});

router.get("/:id", requireAuth, async (req, res) => {
  if (isLocalMode) {
    const event = localDb.getEvent(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const programIds = (event.event_audiences || [])
      .map((row) => row.program_id)
      .filter((id) => id !== null && id !== undefined);
    const students = localDb.listAccounts("student");
    const enrolled = programIds.length
      ? students.filter((student) => programIds.includes(student.program?.id)).length
      : students.length;

    if (!canViewEvent(req.user, event)) {
      return res.status(403).json({ error: "You do not have access to this event" });
    }

    return res.json({
      event: { ...event, event_summaries: [] },
      tally: { present: 0, late: 0, absent: 0 },
      enrolled,
      my_access: { gatekeeper: false, expires_at: null, role: req.user.role },
    });
  }

  const { data, error } = await admin
    .from("events")
    .select(
      `${await eventFields()}, event_organizers(profile:profiles(id, school_id, full_name)), event_audiences(program:programs(id, code, name)), event_summaries(*)`
    )
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Event not found" });

  // Lets the mobile app decide whether to open the gatekeeper scanner for this
  // event, even though the account is still a student. The same grant is part
  // of the access check below.
  const grant = await findGrant(req.user.id, req.params.id);
  if (!canViewEvent(req.user, data, grant)) {
    return res.status(403).json({ error: "You do not have access to this event" });
  }

  const { data: counts, error: countError } = await admin
    .from("attendance")
    .select("status")
    .eq("event_id", req.params.id);
  if (countError) throw countError;

  const tally = { present: 0, late: 0, absent: 0 };
  for (const row of counts || []) tally[row.status] = (tally[row.status] || 0) + 1;

  const programIds = (data.event_audiences || [])
    .map((row) => row.program_id ?? row.program?.id)
    .filter((id) => id !== null && id !== undefined);

  let enrolledQuery = admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "student")
    .eq("is_active", true);
  if (programIds.length) enrolledQuery = enrolledQuery.in("program_id", programIds);

  const { count: enrolledCount, error: enrolledError } = await enrolledQuery;
  if (enrolledError) throw enrolledError;

  res.json({
    event: { ...data, live: isLiveWindow(data) },
    tally,
    enrolled: enrolledCount ?? 0,
    my_access: {
      gatekeeper: Boolean(grant),
      expires_at: grant?.expires_at ?? null,
      role: req.user.role,
    },
  });
});

function eventPayload(body) {
  const allowed = [
    "name",
    "description",
    "venue",
    "event_date",
    "start_time",
    "end_time",
    "grace_minutes",
    "scan_mode",
    "status",
    "qr_window_seconds",
  ];
  const payload = {};
  for (const key of allowed) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
}

async function replaceOrganizers(eventId, ids) {
  if (!Array.isArray(ids)) return;
  await admin.from("event_organizers").delete().eq("event_id", eventId);
  if (ids.length) {
    await admin.from("event_organizers").insert(ids.map((profile_id) => ({ event_id: eventId, profile_id })));
  }
}

/**
 * Grants the whole list a time-boxed scanner role for this event. Kept in its
 * own table so replacing the permanent organizer list cannot wipe grants.
 */
async function replaceTempOrganizers(event, ids, grantedBy) {
  if (!Array.isArray(ids)) return;
  if (!(await hasTempOrganizerTables())) return;

  const expiresAt = organizerGrantExpiry(event);
  if (!expiresAt) return;

  await admin.from("event_temp_organizers").delete().eq("event_id", event.id);
  if (!ids.length) return;

  const { error } = await admin.from("event_temp_organizers").insert(
    ids.map((profile_id) => ({
      event_id: event.id,
      profile_id,
      expires_at: expiresAt.toISOString(),
      granted_by: grantedBy,
    }))
  );
  if (error) throw error;
}

/**
 * Rescheduling an event must not leave grants on the old window, or the
 * gatekeeper is locked out early / keeps access after the new end time.
 */
async function refreshTempOrganizerExpiry(event) {
  if (!(await hasTempOrganizerTables())) return;

  const expiresAt = organizerGrantExpiry(event);
  if (!expiresAt) return;

  const { error } = await admin
    .from("event_temp_organizers")
    .update({ expires_at: expiresAt.toISOString() })
    .eq("event_id", event.id);
  if (error) throw error;
}

async function replaceAudiences(eventId, ids) {
  if (!Array.isArray(ids)) return;
  await admin.from("event_audiences").delete().eq("event_id", eventId);
  if (ids.length) {
    await admin.from("event_audiences").insert(ids.map((program_id) => ({ event_id: eventId, program_id })));
  }
}

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const body = req.body || {};
  const payload = eventPayload(body);
  if (!payload.name || !payload.venue || !payload.event_date || !payload.start_time || !payload.end_time) {
    return res.status(400).json({ error: "name, venue, event_date, start_time and end_time are required" });
  }
  if (payload.end_time <= payload.start_time) {
    return res.status(400).json({ error: "end_time must be after start_time" });
  }

  const geo = parseGeoInput(body);
  if (!geo.ok) return res.status(400).json({ error: geo.error });
  Object.assign(payload, geo.payload);

  if (isLocalMode) {
    const event = localDb.createEvent(
      { ...payload, organizer_ids: body.organizer_ids, program_ids: body.program_ids },
      req.user.id
    );
    return res.status(201).json({ event });
  }

  if (Object.keys(geo.payload).length && !(await hasGeofenceColumns())) {
    return res.status(503).json({
      error: "Venue location is not enabled yet. Run supabase/migrations/0006_geofence.sql.",
      code: "migration_required",
    });
  }

  const { data: event, error } = await admin
    .from("events")
    .insert({ ...payload, created_by: req.user.id })
    .select()
    .single();
  if (error) throw error;

  await replaceOrganizers(event.id, body.organizer_ids);
  await replaceAudiences(event.id, body.program_ids);
  await replaceTempOrganizers(event, body.temp_organizer_ids, req.user.id);

  res.status(201).json({ event });
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const body = req.body || {};
  const payload = eventPayload(body);
  if (payload.end_time && payload.start_time && payload.end_time <= payload.start_time) {
    return res.status(400).json({ error: "end_time must be after start_time" });
  }

  const geo = parseGeoInput(body);
  if (!geo.ok) return res.status(400).json({ error: geo.error });
  Object.assign(payload, geo.payload);

  if (isLocalMode) {
    const event = localDb.updateEvent(req.params.id, {
      ...payload,
      organizer_ids: body.organizer_ids,
      program_ids: body.program_ids,
    });
    if (!event) return res.status(404).json({ error: "Event not found" });
    return res.json({ event });
  }

  if (Object.keys(geo.payload).length && !(await hasGeofenceColumns())) {
    return res.status(503).json({
      error: "Venue location is not enabled yet. Run supabase/migrations/0006_geofence.sql.",
      code: "migration_required",
    });
  }

  // A request that only replaces organizers/temp organizers has no event fields
  // to write, and PostgREST rejects an empty update payload.
  let event;
  if (Object.keys(payload).length) {
    const { data, error } = await admin
      .from("events")
      .update(payload)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    event = data;
  } else {
    event = await getEvent(req.params.id);
  }
  if (!event) return res.status(404).json({ error: "Event not found" });

  await replaceOrganizers(event.id, body.organizer_ids);
  await replaceAudiences(event.id, body.program_ids);
  await replaceTempOrganizers(event, body.temp_organizer_ids, req.user.id);

  // When the admin edits the date or end time without resending the grant list,
  // move the existing grants to the new event end.
  const scheduleChanged =
    Object.hasOwn(payload, "event_date") || Object.hasOwn(payload, "end_time");
  if (body.temp_organizer_ids === undefined && scheduleChanged) {
    await refreshTempOrganizerExpiry(event);
  }

  res.json({ event });
});

router.put("/:id/organizers", requireAuth, requireRole("admin"), async (req, res) => {
  if (isLocalMode) {
    const event = localDb.updateEvent(req.params.id, {
      organizer_ids: req.body?.organizer_ids,
    });
    if (!event) return res.status(404).json({ error: "Event not found" });
    return res.json({ ok: true });
  }
  await replaceOrganizers(req.params.id, req.body?.organizer_ids);
  res.json({ ok: true });
});

router.put("/:id/audiences", requireAuth, requireRole("admin"), async (req, res) => {
  if (isLocalMode) {
    const event = localDb.updateEvent(req.params.id, {
      program_ids: req.body?.program_ids,
    });
    if (!event) return res.status(404).json({ error: "Event not found" });
    return res.json({ ok: true });
  }
  await replaceAudiences(req.params.id, req.body?.program_ids);
  res.json({ ok: true });
});

router.post("/:id/close", requireAuth, requireRole("admin"), async (req, res) => {
  const eventId = req.params.id;

  if (isLocalMode) {
    const event = localDb.getEvent(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const programIds = new Set((event.event_audiences || []).map((row) => row.program_id));
    const enrolled = localDb
      .listAccounts("student")
      .filter((student) => programIds.has(student.program_id)).length;

    localDb.updateEvent(eventId, { status: "completed" });
    return res.json({
      summary: {
        event_id: eventId,
        enrolled,
        present: 0,
        late: 0,
        absent: enrolled,
        attendance_rate: 0,
        generated_at: new Date().toISOString(),
      },
    });
  }

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event) return res.status(404).json({ error: "Event not found" });

  const { data: audiences, error: audienceError } = await admin
    .from("event_audiences")
    .select("program_id")
    .eq("event_id", eventId);
  if (audienceError) throw audienceError;
  const programIds = (audiences || []).map((row) => row.program_id);

  let enrolledQuery = admin
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .eq("is_active", true);
  if (programIds.length) enrolledQuery = enrolledQuery.in("program_id", programIds);

  const { data: enrolledStudents, error: enrolledError } = await enrolledQuery;
  if (enrolledError) throw enrolledError;
  const enrolledIds = new Set((enrolledStudents || []).map((s) => s.id));

  const { data: records, error: recordError } = await admin
    .from("attendance")
    .select("student_id, status")
    .eq("event_id", eventId);
  if (recordError) throw recordError;

  const recorded = new Map((records || []).map((r) => [r.student_id, r.status]));
  const missing = [...enrolledIds].filter((id) => !recorded.has(id));
  if (missing.length) {
    await admin.from("attendance").insert(
      missing.map((student_id) => ({ event_id: eventId, student_id, status: "absent", method: null }))
    );
  }

  const present = (records || []).filter((r) => r.status === "present").length;
  const late = (records || []).filter((r) => r.status === "late").length;
  const enrolled = enrolledIds.size;
  const absent = Math.max(enrolled - present - late, 0);
  const rate = enrolled ? Math.round(((present + late) / enrolled) * 10000) / 100 : 0;

  const { data: summary, error: summaryError } = await admin
    .from("event_summaries")
    .upsert(
      { event_id: eventId, enrolled, present, late, absent, attendance_rate: rate, generated_at: new Date().toISOString() },
      { onConflict: "event_id" }
    )
    .select()
    .single();
  if (summaryError) throw summaryError;

  await admin.from("events").update({ status: "completed" }).eq("id", eventId);

  res.json({ summary });
});


/* ---------------------------------------- organizer gatekeepers (0011) */

const GATEKEEPER_LIMIT = 25;

/** Staff may manage any event; an organizer only events they are assigned to. */
async function canManageGatekeepers(user, eventId) {
  if (user.role === "admin" || user.role === "superadmin") return true;

  const { data, error } = await admin
    .from("event_organizers")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function gatekeeperEvent(req, res) {
  if (!(await hasTempOrganizerTables())) {
    res.status(503).json({
      error: "Temporary organizer access needs migration 0008_temp_organizers.sql",
      code: "migration_required",
    });
    return null;
  }

  const event = await getEvent(req.params.id);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return null;
  }

  if (!(await canManageGatekeepers(req.user, event.id))) {
    res.status(403).json({
      error: "Only the organizers assigned to this event can manage its gatekeepers",
      code: "forbidden",
    });
    return null;
  }

  return event;
}

router.get("/:id/gatekeepers", requireAuth, async (req, res) => {
  const event = await gatekeeperEvent(req, res);
  if (!event) return;

  const { data, error } = await admin
    .from("event_temp_organizers")
    .select(
      "expires_at, created_at, granted_by, profile:profiles!profile_id!inner(id, school_id, full_name, photo_url, deleted_at, program:programs(id, code, name))"
    )
    .eq("event_id", event.id)
    .gt("expires_at", new Date().toISOString())
    .is("profile.deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  res.json({ gatekeepers: data || [] });
});

router.get("/:id/gatekeeper-candidates", requireAuth, async (req, res) => {
  const event = await gatekeeperEvent(req, res);
  if (!event) return;

  const term = String(req.query.q || "").trim();
  if (term.length < 2) return res.json({ candidates: [] });

  const escaped = term.replace(/[%,()]/g, "");
  const { data, error } = await admin
    .from("profiles")
    .select("id, school_id, full_name, program:programs(id, code, name)")
    .eq("role", "student")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(`full_name.ilike.%${escaped}%,school_id.ilike.%${escaped}%`)
    .limit(10);
  if (error) throw error;

  const [{ data: grants }, { data: organizers }] = await Promise.all([
    admin
      .from("event_temp_organizers")
      .select("profile_id")
      .eq("event_id", event.id)
      .gt("expires_at", new Date().toISOString()),
    admin.from("event_organizers").select("profile_id").eq("event_id", event.id),
  ]);

  const taken = new Set([
    ...(grants || []).map((row) => row.profile_id),
    ...(organizers || []).map((row) => row.profile_id),
  ]);

  res.json({
    candidates: (data || []).filter((row) => !taken.has(row.id)),
  });
});

router.post("/:id/gatekeepers", requireAuth, async (req, res) => {
  const event = await gatekeeperEvent(req, res);
  if (!event) return;

  if (["completed", "cancelled"].includes(event.status)) {
    return res.status(409).json({ error: "This event is already closed." });
  }

  const profileId = String(req.body?.profile_id || "");
  if (!profileId) return res.status(400).json({ error: "profile_id is required" });
  if (profileId === req.user.id) {
    return res.status(400).json({ error: "You already have access to this event." });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, is_active, deleted_at, full_name, school_id")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "student" || !profile.is_active || profile.deleted_at) {
    return res.status(400).json({ error: "Choose an active student account." });
  }

  const { data: permanent, error: permanentError } = await admin
    .from("event_organizers")
    .select("profile_id")
    .eq("event_id", event.id)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (permanentError) throw permanentError;
  if (permanent) {
    return res.status(409).json({ error: "This student is already an organizer for the event." });
  }

  const { data: existing, error: existingError } = await admin
    .from("event_temp_organizers")
    .select("expires_at")
    .eq("event_id", event.id)
    .eq("profile_id", profileId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return res.status(409).json({
      error: "This student already has gatekeeper access.",
      expires_at: existing.expires_at,
    });
  }

  const { count, error: countError } = await admin
    .from("event_temp_organizers")
    .select("profile_id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .gt("expires_at", new Date().toISOString());
  if (countError) throw countError;
  if ((count || 0) >= GATEKEEPER_LIMIT) {
    return res.status(409).json({
      error: `An event can have at most ${GATEKEEPER_LIMIT} gatekeepers.`,
      code: "gatekeeper_limit",
    });
  }

  const expiry = organizerGrantExpiry(event);
  if (!expiry) {
    return res.status(400).json({ error: "That event has no valid date and end time" });
  }

  const { error: grantError } = await admin.from("event_temp_organizers").upsert(
    {
      event_id: event.id,
      profile_id: profileId,
      expires_at: expiry.toISOString(),
      granted_by: req.user.id,
    },
    { onConflict: "event_id,profile_id" }
  );
  if (grantError) throw grantError;

  await writeAudit(req.user.id, "grant", "event", event.id, {
    profile_id: profileId,
    event_name: event.name,
    expires_at: expiry.toISOString(),
  });

  res.status(201).json({
    gatekeeper: {
      profile_id: profileId,
      full_name: profile.full_name,
      school_id: profile.school_id,
      expires_at: expiry.toISOString(),
    },
  });
});

router.delete("/:id/gatekeepers/:profileId", requireAuth, async (req, res) => {
  const event = await gatekeeperEvent(req, res);
  if (!event) return;

  const { data: existing, error } = await admin
    .from("event_temp_organizers")
    .select("profile_id")
    .eq("event_id", event.id)
    .eq("profile_id", req.params.profileId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!existing) return res.status(404).json({ error: "Gatekeeper not found" });

  const { error: deleteError } = await admin
    .from("event_temp_organizers")
    .delete()
    .eq("event_id", event.id)
    .eq("profile_id", req.params.profileId);
  if (deleteError) throw deleteError;

  await writeAudit(req.user.id, "revoke", "event", event.id, {
    profile_id: req.params.profileId,
    event_name: event.name,
  });

  res.json({ ok: true });
});
module.exports = router;
