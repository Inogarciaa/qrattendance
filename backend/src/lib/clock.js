/**
 * Time helpers pinned to Asia/Manila.
 *
 * The API must not depend on the host machine's timezone: a server running in
 * UTC would otherwise treat 8:05 AM PHT as "yesterday evening" and misclassify
 * scans as late (or as belonging to the wrong event day).
 */
const TIME_ZONE = "Asia/Manila";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Current wall-clock parts in Asia/Manila. */
function manilaNow(at = new Date()) {
  const parts = {};
  for (const part of formatter.formatToParts(at)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
    minutes: Number(hour) * 60 + Number(parts.minute),
  };
}

/** "08:00" / "08:00:00" -> minutes since midnight. */
function timeToMinutes(value) {
  const [hours = "0", minutes = "0"] = String(value ?? "").split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** True when `at` falls inside the event's date and start/end window. */
function isLiveWindow(event, at = new Date()) {
  if (!event?.event_date || !event?.start_time || !event?.end_time) return false;
  // Drafts are not open yet. Completed, cancelled, and closed are finished.
  if (event.status === "draft" || event.status === "completed" || event.status === "cancelled" || event.status === "closed") {
    return false;
  }

  const now = manilaNow(at);
  if (String(event.event_date) !== now.date) return false;

  return (
    now.minutes >= timeToMinutes(event.start_time) &&
    now.minutes <= timeToMinutes(event.end_time)
  );
}

/** "present" inside the grace window, otherwise "late". */
function arrivalStatus(event, at = new Date()) {
  const now = manilaNow(at);
  const deadline = timeToMinutes(event.start_time) + Number(event.grace_minutes || 0);
  return now.minutes <= deadline ? "present" : "late";
}

/**
 * The event's end as a real instant. Asia/Manila is UTC+8 all year, so the
 * offset can be applied directly instead of depending on the host timezone.
 */
function eventEndInstant(event) {
  const date = String(event?.event_date || "").slice(0, 10);
  const time = String(event?.end_time || "");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hours - 8, minutes));
}

/**
 * Temporary gatekeeper access ends an hour after the event, which covers late
 * check-ins without leaving the grant open for the rest of the day.
 */
function organizerGrantExpiry(event, extraMinutes = 60) {
  const end = eventEndInstant(event);
  if (!end) return null;
  return new Date(end.getTime() + extraMinutes * 60_000);
}

/** Tuesday, November 10, 2026 */
function formatEventDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

module.exports = {
  TIME_ZONE,
  manilaNow,
  timeToMinutes,
  isLiveWindow,
  arrivalStatus,
  eventEndInstant,
  organizerGrantExpiry,
  formatEventDate,
};
