/**
 * Staff accounts for the web dashboard.
 *
 * Real credentials live in backend/.env (gitignored). The fallbacks here are
 * placeholders only so a fresh checkout can boot without crashing.
 */
function staffAccounts() {
  return [
    {
      school_id: "SUPERADMIN-0001",
      full_name: "LacoQR Superadmin",
      email: process.env.SUPERADMIN_EMAIL || "superadmin@example.com",
      password: process.env.SUPERADMIN_PASSWORD || "change-me-superadmin",
      role: "superadmin",
      program_code: null,
      year_level: null,
      birthdate: "1990-01-01",
    },
    {
      school_id: "ADMIN-0001",
      full_name: "LacoQR Admin",
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      password: process.env.ADMIN_PASSWORD || "change-me-admin",
      role: "admin",
      program_code: null,
      year_level: null,
      birthdate: "1990-01-01",
    },
  ];
}

module.exports = { staffAccounts };
