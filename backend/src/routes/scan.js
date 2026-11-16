const express = require("express");
const { admin } = require("../lib/supabase");
const { validateToken, consumeToken } = require("../services/tokens");
const {
  computeStatus,
  isLive,
  isEnrolled,
  getEvent,
  canScan,
  existingAttendance,
  logAttempt,
} = require("../services/attendance");
const { requireAuth, requireRole } = require("../middleware/auth");
const { evaluateGeofence, parseFix } = require("../lib/geo");
const { hasGeofenceColumns } = require("../lib/schema");

const router = express.Router();

async function loadStudent(studentId) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, school_id, full_name, year_level, photo_url, role, is_active, program:programs(id, code, name)")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

router.post("/preview", requireAuth, async (req, res) => {
  const { event_id, token } = req.body || {};
  if (!event_id || !token) return res.status(400).json({ error: "event_id and token are required" });

  const event = await getEvent(event_id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (!(await canScan(req.user, event_id))) {
    return res.status(403).json({ error: "You are not assigned to this event" });
  }

  const check = await validateToken(token, { subjectType: "student" });
  if (!check.ok) {
    await logAttempt({ event_id, scanned_by: req.user.id, method: "gatekeeper", result: "rejected", reason: check.reason, token });
    return res.status(422).json({ error: "Invalid or expired QR code", reason: check.reason });
  }

  // A student can be a temporary gatekeeper. They still cannot record their
  // own attendance through the gate they are running.
  if (check.row.subject_id === req.user.id) {
    await logAttempt({ event_id, student_id: req.user.id, scanned_by: req.user.id, method: "gatekeeper", result: "rejected", reason: "self_scan", token });
    return res.status(422).json({
      error: "That is your own code. Ask another organizer to scan you.",
      reason: "self_scan",
    });
  }

  const student = await loadStudent(check.row.subject_id);
  if (!student || !student.is_active) {
    await logAttempt({ event_id, student_id: check.row.subject_id, scanned_by: req.user.id, method: "gatekeeper", result: "rejected", reason: "student_inactive", token });
    return res.status(422).json({ error: "Student is not active", reason: "student_inactive" });
  }

  const existing = await existingAttendance(event_id, student.id);
  res.json({
    event: { id: event.id, name: event.name, scan_mode: event.scan_mode, live: isLive(event) },
    student,
    predicted_status: computeStatus(event),
    already_checked_in: Boolean(existing),
    existing: existing || null,
  });
});

router.post("/confirm", requireAuth, async (req, res) => {
  const { event_id, token } = req.body || {};
  if (!event_id || !token) return res.status(400).json({ error: "event_id and token are required" });

  const event = await getEvent(event_id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (!(await canScan(req.user, event_id))) {
    return res.status(403).json({ error: "You are not assigned to this event" });
  }
  if (event.scan_mode === "self_service") {
    return res.status(409).json({ error: "This event does not use gatekeeper scanning" });
  }

  const check = await validateToken(token, { subjectType: "student" });
  if (!check.ok) {
    await logAttempt({ event_id, scanned_by: req.user.id, method: "gatekeeper", result: "rejected", reason: check.reason, token });
    return res.status(422).json({ error: "Invalid or expired QR code", reason: check.reason });
  }

  if (check.row.subject_id === req.user.id) {
    await logAttempt({ event_id, student_id: req.user.id, scanned_by: req.user.id, method: "gatekeeper", result: "rejected", reason: "self_scan", token });
    return res.status(422).json({
      error: "That is your own code. Ask another organizer to scan you.",
      reason: "self_scan",
    });
  }

  const student = await loadStudent(check.row.subject_id);
  if (!student || !student.is_active) {
    await logAttempt({ event_id, student_id: check.row.subject_id, scanned_by: req.user.id, method: "gatekeeper", result: "rejected", reason: "student_inactive", token });
    return res.status(422).json({ error: "Student is not active" });
  }

  const existing = await existingAttendance(event_id, student.id);
  if (existing) {
    await logAttempt({ event_id, student_id: student.id, scanned_by: req.user.id, method: "gatekeeper", result: "rejected", reason: "duplicate", token });
    return res.status(409).json({ error: "Student already checked in", existing });
  }

  const status = computeStatus(event);
  const { data: record, error } = await admin
    .from("attendance")
    .insert({
      event_id,
      student_id: student.id,
      status,
      method: "gatekeeper",
      scanned_by: req.user.id,
      token_id: check.row.id,
    })
    .select()
    .single();
  if (error) throw error;

  await consumeToken(check.row.id);
  await logAttempt({ event_id, student_id: student.id, scanned_by: req.user.id, method: "gatekeeper", result: "accepted", token });

  res.status(201).json({ attendance: record, student: { id: student.id, full_name: student.full_name } });
});

router.post("/self-checkin", requireAuth, requireRole("student"), async (req, res) => {
  const { event_id, token } = req.body || {};
  if (!event_id || !token) return res.status(400).json({ error: "event_id and token are required" });

  const event = await getEvent(event_id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.scan_mode === "gatekeeper") {
    return res.status(409).json({ error: "This event uses gatekeeper scanning only" });
  }
  if (!isLive(event)) {
    await logAttempt({ event_id, student_id: req.user.id, method: "self_service", result: "rejected", reason: "event_not_live", token });
    return res.status(409).json({ error: "Event is not currently accepting check-ins" });
  }

  const check = await validateToken(token, { subjectType: "event", subjectId: event_id });
  if (!check.ok) {
    await logAttempt({ event_id, student_id: req.user.id, method: "self_service", result: "rejected", reason: check.reason, token });
    return res.status(422).json({ error: "Invalid or expired QR code", reason: check.reason });
  }

  if (!(await isEnrolled(event_id, req.user.program_id))) {
    await logAttempt({ event_id, student_id: req.user.id, method: "self_service", result: "rejected", reason: "not_enrolled", token });
    return res.status(403).json({ error: "You are not included in this event" });
  }

  const existing = await existingAttendance(event_id, req.user.id);
  if (existing) {
    return res.status(409).json({ error: "Already checked in", existing });
  }

  // Second gate: the phone has to be at the venue. Only runs once migration
  // 0006 is applied, so a fresh install keeps working without it.
  let fence = { applied: false, allowed: true, verified: null, reason: null, distance_m: null, accuracy_m: null, radius_m: null, mocked: false };
  if (await hasGeofenceColumns()) {
    fence = evaluateGeofence(event, parseFix(req.body || {}));

    if (!fence.allowed) {
      await logAttempt({ event_id, student_id: req.user.id, method: "self_service", result: "rejected", reason: fence.reason, token });
      return res.status(403).json({
        error: `You are about ${Math.round(fence.distance_m)} m from the venue (limit ${fence.radius_m} m)`,
        code: fence.reason,
        distance_m: fence.distance_m,
        radius_m: fence.radius_m,
      });
    }
  }

  const status = computeStatus(event);
  const record = {
    event_id,
    student_id: req.user.id,
    status,
    method: "self_service",
    scanned_by: null,
    token_id: check.row.id,
  };
  if (fence.applied) {
    record.distance_m = fence.distance_m;
    record.accuracy_m = fence.accuracy_m;
    record.location_verified = fence.verified;
    record.location_mocked = fence.mocked;
  }

  const { data: attendance, error } = await admin.from("attendance").insert(record).select().single();
  if (error) throw error;

  await logAttempt({
    event_id,
    student_id: req.user.id,
    method: "self_service",
    result: "accepted",
    reason: fence.reason,
    token,
  });

  res.status(201).json({
    attendance,
    location: {
      applied: fence.applied,
      verified: fence.verified,
      distance_m: fence.distance_m,
      radius_m: fence.radius_m,
    },
  });
});

module.exports = router;
