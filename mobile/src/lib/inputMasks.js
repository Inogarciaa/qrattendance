const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

function digitsOnly(value, max) {
  return String(value ?? "").replace(/\D/g, "").slice(0, max);
}

/** Keeps a school ID in the 2023-0142 shape while the person types. */
export function maskSchoolId(value) {
  const digits = digitsOnly(value, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/** Mirrors the API's rule: 8 digits, shown as 2023-0142. */
export function schoolIdError(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Enter your school ID.";
  if (!/^\d{4}-\d{4}$/.test(text)) return "School ID must be 8 digits, like 2023-0142.";
  return "";
}

/** Mirrors the API: a real YYYY-MM-DD date for someone aged 10-100. */
export function birthdateError(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Enter your birthdate.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return "Birthdate must be YYYY-MM-DD, like 2003-04-12.";
  }

  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    return "That date does not exist. Use YYYY-MM-DD, like 2003-04-12.";
  }

  const age = (Date.now() - date.getTime()) / MS_PER_YEAR;
  if (age < 10 || age > 100) return "Birthdate must be between 10 and 100 years ago.";
  return "";
}
