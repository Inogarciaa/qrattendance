const pad = (value) => String(value).padStart(2, "0");

export function formatTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  return `${hours % 12 || 12}:${pad(normalized % 60)} ${hours >= 12 ? "PM" : "AM"}`;
}

export function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function initials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}
