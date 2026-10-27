const express = require("express");
const { admin } = require("../lib/supabase");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const SELECT = `
  id, status, method, scanned_at,
  student:profiles!inner(school_id, full_name, program:programs(id, code, name)),
  event:events!inner(id, name, event_date, venue)
`;

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function buildRows(filters) {
  const { event_id, status, program_id, from, to } = filters;
  let query = admin.from("attendance").select(SELECT).order("scanned_at", { ascending: false });

  if (event_id) query = query.eq("event_id", event_id);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("event.event_date", from);
  if (to) query = query.lte("event.event_date", to);

  const { data, error } = await query;
  if (error) throw error;

  let rows = data || [];
  if (program_id) {
    rows = rows.filter((row) => String(row.student?.program?.id) === String(program_id));
  }
  return rows;
}

router.use(requireAuth, requireRole("admin"));

router.get("/", async (req, res) => {
  const rows = await buildRows(req.query);
  res.json({ count: rows.length, records: rows });
});

router.get("/export", async (req, res) => {
  const rows = await buildRows(req.query);
  const header = ["Event", "Event Date", "Venue", "School ID", "Student", "Program", "Status", "Method", "Scanned At"];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.event?.name,
        row.event?.event_date,
        row.event?.venue,
        row.student?.school_id,
        row.student?.full_name,
        row.student?.program?.code,
        row.status,
        row.method ?? "",
        row.scanned_at,
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-report-${stamp}.csv"`);
  res.send(lines.join("\n"));
});

module.exports = router;
