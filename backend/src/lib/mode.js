const url = process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// The repository ships placeholder Supabase credentials. When they have not
// been replaced, run against the file-backed local database so the system is
// still usable for development and demos.
const isLocalMode =
  !url ||
  url.includes("your-project") ||
  !serviceKey ||
  serviceKey === "your-service-role-key";

module.exports = { isLocalMode };
