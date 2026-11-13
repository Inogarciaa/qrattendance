const express = require("express");
const { admin } = require("../lib/supabase");
const { toEmail, buildPassword, toBirthdate } = require("../lib/password");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isLocalMode } = require("../lib/mode");
const { listAccounts } = require("../lib/local-db");

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
  const { q, program_id } = req.query;

  if (isLocalMode) {
    let students = listAccounts("student").map((account) => ({
      id: account.id,
      school_id: account.school_id,
      full_name: account.full_name,
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
          student.school_id.toLowerCase().includes(needle)
      );
    }
    return res.json({ students });
  }

  let query = admin
    .from("profiles")
    .select("id, school_id, full_name, year_level, photo_url, is_active, program:programs(id, code, name)")
    .eq("role", "student")
    .order("full_name");

  if (program_id) query = query.eq("program_id", program_id);
  if (q) query = query.or(`full_name.ilike.%${q}%,school_id.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) throw error;
  res.json({ students: data });
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

module.exports = router;
