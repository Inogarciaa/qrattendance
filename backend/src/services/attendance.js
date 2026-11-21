const { admin } = require("../lib/supabase");
const { arrivalStatus, isLiveWindow } = require("../lib/clock");
const { hasTempOrganizerTables } = require("../lib/schema");

/**
 * All event windows are evaluated in Asia/Manila. Building Dates from
 * `${event_date}T${start_time}` would use the server's local timezone and
 * misclassify scans when the API runs on a UTC host.
 */
function isLive(event, at = new Date()) {
  return isLiveWindow(event, at);
}

function computeStatus(event, at = new Date()) {
  return arrivalStatus(event, at);
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
  const { data, error } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function canScan(user, eventId) {
  if (user.role === "admin" || user.role === "superadmin") return true;
  const { data, error } = await admin
    .from("event_organizers")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return true;

  // Students can be approved as a gatekeeper for one event. The grant carries
  // its own expiry, so access disappears without an admin doing anything.
  return Boolean(await findGrant(user.id, eventId));
}

/** Active temporary organizer grant for this profile and event, if any. */
async function findGrant(profileId, eventId) {
  if (!(await hasTempOrganizerTables())) return null;

  const { data, error } = await admin
    .from("event_temp_organizers")
    .select("event_id, expires_at")
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data || null;
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
  isLive,
  computeStatus,
  isEnrolled,
  getEvent,
  canScan,
  findGrant,
  existingAttendance,
  logAttempt,
};
