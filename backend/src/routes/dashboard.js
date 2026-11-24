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
    .map((row) => row.program_id ?? row.program?.id)
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
    return students.filter((student) =>
      programIds.includes(student.program_id ?? student.program?.id)
    ).length;
  }

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

async function attendanceRows(eventId) {
  if (isLocalMode) return [];

  const { data, error } = await admin
    .from("attendance")
    .select(
      "status, method, scanned_at, student:profiles!attendance_student_id_fkey(school_id, full_name, photo_url, program:programs(code))"
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
      .filter(
        (event) =>
          String(event.event_date) === today &&
          event.status !== "cancelled" &&
          event.status !== "draft"
      );
  }

  const { data, error } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .eq("event_date", today)
    .is("deleted_at", null)
    .not("status", "in", "(draft,cancelled)")
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function nextEvent(now) {
  if (isLocalMode) {
    return (
      localDb
        .listEvents()
        .filter((event) => {
          if (["closed", "completed", "cancelled", "draft"].includes(event.status)) return false;
          const evDate = String(event.event_date);
          if (evDate > now.date) return true;
          if (evDate === now.date) return String(event.end_time) > now.time;
          return false;
        })
        .sort((a, b) =>
          `${a.event_date}${a.start_time}`.localeCompare(`${b.event_date}${b.start_time}`)
        )[0] || null
    );
  }

  const { data, error } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .gte("event_date", now.date)
    .is("deleted_at", null)
    .not("status", "in", "(draft,completed,cancelled)")
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(10);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return (
    data.find((event) => {
      const evDate = String(event.event_date);
      if (evDate > now.date) return true;
      if (evDate === now.date) return String(event.end_time) > now.time;
      return false;
    }) || null
  );
}

router.get("/live", async (req, res, next) => {
  try {
    const now = manilaNow();
    const events = await todaysEvents(now.date);
    const liveEvents = events.filter((event) => isLiveWindow(event));

    const live = [];
    for (const event of liveEvents) {
      const enrolled = await countAudience(event);
      const rows = await attendanceRows(event.id);

      const present = rows.filter((row) => row.status === "present").length;
      const late = rows.filter((row) => row.status === "late").length;
      const absent = Math.max(0, enrolled - present - late);

      const counts = { enrolled, present, late, absent };

      live.push({
        event,
        counts,
        tally: counts,
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
      next: live.length ? null : await nextEvent(now),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
