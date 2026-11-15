const express = require("express");
const { admin } = require("../lib/supabase");
const { isLocalMode } = require("../lib/mode");
const { isLiveWindow, manilaNow } = require("../lib/clock");
const localDb = require("../lib/local-db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

const EVENT_FIELDS =
  "id, name, venue, event_date, start_time, end_time, grace_minutes, scan_mode, status, qr_window_seconds";
const EVENT_SELECT = `${EVENT_FIELDS}, event_audiences(program_id)`;

function audienceProgramIds(event) {
  return (event.event_audiences || [])
    .map((row) => row.program_id)
    .filter((id) => id !== null && id !== undefined);
}

/**
 * Expected audience for an event: students in the selected programs, or every
 * active student when the event has no audience rows.
 */
async function countAudience(event) {
  const programIds = audienceProgramIds(event);

  if (isLocalMode) {
    const students = localDb.listAccounts("student");
    if (!programIds.length) return students.length;
    return students.filter((student) => programIds.includes(student.program?.id)).length;
  }

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

async function attendanceRows(eventId) {
  if (isLocalMode) return [];

  const { data, error } = await admin
    .from("attendance")
    .select(
      "status, method, scanned_at, student:profiles!attendance_student_id_fkey(school_id, full_name, program:programs(code))"
    )
    .eq("event_id", eventId)
    .order("scanned_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function todaysEvents(today) {
  if (isLocalMode) {
    return localDb
      .listEvents()
      .filter((event) => String(event.event_date) === today);
  }

  const { data, error } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .eq("event_date", today)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function nextEvent(today) {
  if (isLocalMode) {
    return (
      localDb
        .listEvents()
        .filter(
          (event) =>
            String(event.event_date) >= today &&
            event.status !== "closed" &&
            event.status !== "completed" &&
            event.status !== "cancelled"
        )
        .sort((a, b) =>
          `${a.event_date}${a.start_time}`.localeCompare(`${b.event_date}${b.start_time}`)
        )[0] || null
    );
  }

  const { data, error } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .gte("event_date", today)
    .not("status", "in", "(completed,cancelled)")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

router.get("/live", async (req, res) => {
  const now = manilaNow();
  const events = await todaysEvents(now.date);
  const liveEvents = events.filter((event) => isLiveWindow(event, new Date()));

  const live = [];
  for (const event of liveEvents) {
    const enrolled = await countAudience(event);
    const rows = await attendanceRows(event.id);

    const present = rows.filter((row) => row.status === "present").length;
    const late = rows.filter((row) => row.status === "late").length;
    const absent = Math.max(0, enrolled - present - late);

    live.push({
      event,
      counts: { enrolled, present, late, absent },
      attendance_rate: enrolled
        ? Math.round(((present + late) / enrolled) * 100)
        : 0,
      recent_scans: rows.filter((row) => row.status !== "absent").slice(0, 10),
    });
  }

  res.json({
    mode: isLocalMode ? "local" : "supabase",
    checked_at: new Date().toISOString(),
    today: now.date,
    live,
    next: live.length ? null : await nextEvent(now.date),
  });
});

module.exports = router;
