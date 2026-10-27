const DOMAIN = process.env.AUTH_EMAIL_DOMAIN || "lccb.local";

const digits = (value) => String(value ?? "").replace(/\D/g, "");

function toEmail(schoolId) {
  const local = String(schoolId ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${local}@${DOMAIN}`;
}

function buildPassword(schoolId, birthdate) {
  const id = digits(schoolId);
  if (!id) throw new Error("school_id has no digits");

  const date = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (Number.isNaN(date.getTime())) throw new Error("invalid birthdate");

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${id}${yyyy}${mm}${dd}`;
}

function toBirthdate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

module.exports = { toEmail, buildPassword, toBirthdate, digits };
