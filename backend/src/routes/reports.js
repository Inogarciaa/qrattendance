const express = require("express");
const { admin } = require("../lib/supabase");
const { isLocalMode } = require("../lib/mode");
const { requireAuth, requireRole } = require("../middleware/auth");
const { hasGeofenceColumns } = require("../lib/schema");

const router = express.Router();

const SELECT = `
  id, status, method, scanned_at,
  student:profiles!attendance_student_id_fkey!inner(school_id, full_name, photo_url, program:programs(id, code, name)),
  event:events!inner(id, name, event_date, venue)
`;

/** Migration 0006 columns, appended only once the SQL has been applied. */
const LOCATION_SELECT = ", distance_m, accuracy_m, location_verified, location_mocked";

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function verificationLabel(row) {
  if (row.location_mocked) return "Mocked";
  if (row.location_verified === true) return "Yes";
  if (row.location_verified === false) return "No";
  return "";
}

function capitalize(value) {
  const text = String(value ?? "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

async function buildRows(filters) {
  const { event_id, status, program_id, from, to } = filters;
  const location = (await hasGeofenceColumns()) ? LOCATION_SELECT : "";
  let query = admin
    .from("attendance")
    .select(`${SELECT}${location}`)
    .is("event.deleted_at", null)
    .is("student.deleted_at", null)
    .order("scanned_at", { ascending: false });

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

/**
 * A student's own attendance history. Registered before the admin guard so the
 * mobile app can call it with a student token.
 */
router.get("/me", requireAuth, requireRole("student"), async (req, res) => {
  if (isLocalMode) return res.json({ records: [], mode: "local" });

  const { data, error } = await admin
    .from("attendance")
    .select(
      "id, status, method, scanned_at, event:events!inner(id, name, venue, event_date, start_time, end_time)"
    )
    .eq("student_id", req.user.id)
    .order("scanned_at", { ascending: false });

  if (error) throw error;
  res.json({ records: data || [] });
});

router.use(requireAuth, requireRole("admin"));

router.get("/", async (req, res) => {
  if (isLocalMode) return res.json({ count: 0, records: [], mode: "local" });
  const rows = await buildRows(req.query);
  res.json({ count: rows.length, records: rows });
});

router.get("/export", async (req, res) => {
  const rows = isLocalMode ? [] : await buildRows(req.query);
  const header = [
    "Event",
    "Event Date",
    "Venue",
    "School ID",
    "Student",
    "Program",
    "Status",
    "Method",
    "Scanned At",
    "Location Verified",
    "Distance (m)",
    "Accuracy (m)",
  ];

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
        capitalize(row.status),
        row.method ?? "",
        row.scanned_at,
        verificationLabel(row),
        row.distance_m ?? "",
        row.accuracy_m ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-report-${stamp}.csv"`);
  // The BOM keeps Excel from mis-reading the UTF-8 names and en dashes.
  res.send("\uFEFF" + lines.join("\r\n"));
});

module.exports = router;
