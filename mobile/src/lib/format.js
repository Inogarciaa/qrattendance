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

export function makeMockToken(prefix = "LQ") {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}.${Date.now().toString(36).toUpperCase()}.${random}`;
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}
