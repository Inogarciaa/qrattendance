const express = require("express");
const { admin } = require("../lib/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const EVENT_FIELDS =
  "id, name, description, venue, event_date, start_time, end_time, grace_minutes, scan_mode, status, qr_window_seconds, created_by, created_at";

const LIST_SELECT = `${EVENT_FIELDS}, event_organizers(profile_id), event_audiences(program_id)`;

router.get("/", requireAuth, async (req, res) => {
  let query = admin.from("events").select(LIST_SELECT).order("event_date", { ascending: false });

  if (req.user.role === "organizer") {
    query = admin
      .from("events")
      .select(`${EVENT_FIELDS}, event_organizers!inner(profile_id), event_audiences(program_id)`)
      .eq("event_organizers.profile_id", req.user.id)
      .order("event_date", { ascending: false });
  } else if (req.user.role === "student") {
    query = admin
      .from("events")
      .select(`${EVENT_FIELDS}, event_organizers(profile_id), event_audiences!inner(program_id)`)
      .eq("event_audiences.program_id", req.user.program_id)
      .order("event_date", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  res.json({ events: data });
});

router.get("/:id", requireAuth, async (req, res) => {
  const { data, error } = await admin
    .from("events")
    .select(
      `${EVENT_FIELDS}, event_organizers(profile:profiles(id, school_id, full_name)), event_audiences(program:programs(id, code, name)), event_summaries(*)`
    )
    .eq("id", req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Event not found" });

  const { data: counts, error: countError } = await admin
    .from("attendance")
    .select("status")
    .eq("event_id", req.params.id);
  if (countError) throw countError;

  const tally = { present: 0, late: 0, absent: 0 };
  for (const row of counts || []) tally[row.status] = (tally[row.status] || 0) + 1;

  const enrolled = (data.event_audiences || []).length === 0
    ? (data.event_summaries?.[0]?.enrolled ?? null)
    : null;

  res.json({ event: data, tally, enrolled });
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

  const { data: event, error } = await admin
    .from("events")
    .insert({ ...payload, created_by: req.user.id })
    .select()
    .single();
  if (error) throw error;

  await replaceOrganizers(event.id, body.organizer_ids);
  await replaceAudiences(event.id, body.program_ids);

  res.status(201).json({ event });
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const body = req.body || {};
  const payload = eventPayload(body);
  if (payload.end_time && payload.start_time && payload.end_time <= payload.start_time) {
    return res.status(400).json({ error: "end_time must be after start_time" });
  }

  const { data: event, error } = await admin
    .from("events")
    .update(payload)
    .eq("id", req.params.id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!event) return res.status(404).json({ error: "Event not found" });

  await replaceOrganizers(event.id, body.organizer_ids);
  await replaceAudiences(event.id, body.program_ids);

  res.json({ event });
});

router.put("/:id/organizers", requireAuth, requireRole("admin"), async (req, res) => {
  await replaceOrganizers(req.params.id, req.body?.organizer_ids);
  res.json({ ok: true });
});

router.put("/:id/audiences", requireAuth, requireRole("admin"), async (req, res) => {
  await replaceAudiences(req.params.id, req.body?.program_ids);
  res.json({ ok: true });
});

router.post("/:id/close", requireAuth, requireRole("admin"), async (req, res) => {
  const eventId = req.params.id;
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

module.exports = router;
