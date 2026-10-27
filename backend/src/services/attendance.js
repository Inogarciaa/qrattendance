const { admin } = require("../lib/supabase");

function eventStart(event) {
  return new Date(`${event.event_date}T${event.start_time}`);
}

function eventEnd(event) {
  return new Date(`${event.event_date}T${event.end_time}`);
}

function isLive(event, at = new Date()) {
  return at >= eventStart(event) && at <= eventEnd(event);
}

function computeStatus(event, at = new Date()) {
  const graceEnd = new Date(eventStart(event).getTime() + (event.grace_minutes || 0) * 60000);
  return at <= graceEnd ? "present" : "late";
}

async function isEnrolled(eventId, programId) {
  const { data, error } = await admin
    .from("event_audiences")
    .select("program_id")
    .eq("event_id", eventId);

  if (error) throw error;
  if (!data || data.length === 0) return true;
  return data.some((row) => row.program_id === programId);
}

async function getEvent(eventId) {
  const { data, error } = await admin.from("events").select("*").eq("id", eventId).maybeSingle();
  if (error) throw error;
  return data;
}

async function canScan(user, eventId) {
  if (user.role === "admin") return true;
  const { data, error } = await admin
    .from("event_organizers")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function existingAttendance(eventId, studentId) {
  const { data, error } = await admin
    .from("attendance")
    .select("*")
    .eq("event_id", eventId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function logAttempt(entry) {
  const { error } = await admin.from("scan_attempts").insert({
    event_id: entry.event_id ?? null,
    student_id: entry.student_id ?? null,
    scanned_by: entry.scanned_by ?? null,
    method: entry.method ?? null,
    result: entry.result,
    reason: entry.reason ?? null,
    token: entry.token ?? null,
  });
  if (error) throw error;
}

module.exports = {
  eventStart,
  eventEnd,
  isLive,
  computeStatus,
  isEnrolled,
  getEvent,
  canScan,
  existingAttendance,
  logAttempt,
};
