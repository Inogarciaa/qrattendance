const express = require("express");
const { admin } = require("../lib/supabase");
const { isLive } = require("../services/attendance");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/live", requireAuth, requireRole("admin"), async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { data: events, error } = await admin
    .from("events")
    .select("id, name, venue, event_date, start_time, end_time, scan_mode, status")
    .eq("event_date", today);
  if (error) throw error;

  const live = (events || []).filter((event) => isLive(event));
  const results = [];

  for (const event of live) {
    const { data: rows, error: rowError } = await admin
      .from("attendance")
      .select("status, scanned_at, student:profiles(full_name, school_id, program:programs(code))")
      .eq("event_id", event.id)
      .order("scanned_at", { ascending: false });
    if (rowError) throw rowError;

    const tally = { enrolled: 0, present: 0, late: 0, absent: 0 };
    for (const row of rows || []) {
      if (row.status === "absent") tally.absent += 1;
      else {
        tally[row.status] += 1;
        tally.enrolled += 1;
      }
    }
    tally.enrolled += tally.absent;

    results.push({
      event,
      tally,
      attendance_rate: tally.enrolled
        ? Math.round(((tally.present + tally.late) / tally.enrolled) * 100)
        : 0,
      recent_scans: (rows || []).filter((r) => r.status !== "absent").slice(0, 10),
    });
  }

  res.json({ live: results });
});

module.exports = router;
