const express = require("express");
const { admin } = require("../lib/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");
const { isLocalMode } = require("../lib/mode");
const { isLiveWindow } = require("../lib/clock");
const { parseGeoInput } = require("../lib/geo");
const { hasGeofenceColumns } = require("../lib/schema");
const localDb = require("../lib/local-db");

const router = express.Router();

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
    .eq("is_active", true);
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

  if (isLocalMode) {
    const events = localDb.listEvents();
    return res.json({ events: withCounts ? events.map(decorateLocal) : events });
  }

  let query = admin.from("events").select(`${await eventFields()}, event_organizers(profile_id), event_audiences(program_id)`).order("event_date", { ascending: false });

  if (req.user.role === "organizer") {
    query = admin
      .from("events")
      .select(`${await eventFields()}, event_organizers!inner(profile_id), event_audiences(program_id)`)
      .eq("event_organizers.profile_id", req.user.id)
      .order("event_date", { ascending: false });
  } else if (req.user.role === "student") {
    query = admin
      .from("events")
      .select(`${await eventFields()}, event_organizers(profile_id), event_audiences!inner(program_id)`)
      .eq("event_audiences.program_id", req.user.program_id)
      .order("event_date", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  const events = withCounts ? await decorateWithCounts(data || []) : data;
  res.json({ events });
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

    return res.json({
      event: { ...event, event_summaries: [] },
      tally: { present: 0, late: 0, absent: 0 },
      enrolled,
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

  res.json({ event: data, tally, enrolled: enrolledCount ?? 0 });
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

module.exports = router;
