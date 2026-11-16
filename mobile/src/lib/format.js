export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function pad(value) {
  return String(value).padStart(2, "0");
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const CAMPUS_TIME_ZONE = "Asia/Manila";

function dateParts(iso) {
  const [year, month, day] = String(iso || "")
    .slice(0, 10)
    .split("-")
    .map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** "2026-11-15" → "Nov 15, 2026" (no Date object, so no timezone drift). */
export function formatEventDate(iso) {
  const parts = dateParts(iso);
  if (!parts) return "";
  return `${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

/** "2026-11-15" → { month: "NOV", day: "15" } for the history cards. */
export function dayParts(iso) {
  const parts = dateParts(iso);
  if (!parts) return { month: "", day: "" };
  return {
    month: MONTHS[parts.month - 1].toUpperCase(),
    day: String(parts.day),
  };
}

/** "08:00" / "08:00:00" → "8:00 AM". */
export function formatClock(time) {
  if (!time) return "";
  const [hoursRaw, minutesRaw] = String(time).split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return String(time);
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 || 12;
  return `${display}:${pad(minutes)} ${suffix}`;
}

/** ("08:00:00", "17:00:00") → "8:00 AM – 5:00 PM". */
export function formatTimeRange(start, end) {
  const from = formatClock(start);
  const to = formatClock(end);
  if (!from && !to) return "";
  if (!to) return from;
  return `${from} – ${to}`;
}

/** ISO timestamp → "Nov 17, 5:00 PM" in campus time. */
export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: CAMPUS_TIME_ZONE,
  });
}

/** ISO timestamp → "8:04 AM" in campus time. */
export function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CAMPUS_TIME_ZONE,
  });
}
