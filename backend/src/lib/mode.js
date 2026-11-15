const url = process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// The repository ships placeholder Supabase credentials. When they have not
// been replaced, run against the file-backed local database so the system is
// still usable for development and demos.
const hasSupabaseConfig =
  Boolean(url) &&
  !url.includes("your-project") &&
  Boolean(serviceKey) &&
  serviceKey !== "your-service-role-key";

const requested = String(process.env.DATA_MODE || "").trim().toLowerCase();

// DATA_MODE makes the choice explicit. Without it we fall back to the old
// "are the credentials filled in?" heuristic so existing checkouts keep working.
let isLocalMode;
if (requested === "local") isLocalMode = true;
else if (requested === "supabase") isLocalMode = false;
else isLocalMode = !hasSupabaseConfig;

if (!isLocalMode && !hasSupabaseConfig) {
  throw new Error(
    "DATA_MODE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
  );
}

console.log(
  `[mode] data source: ${isLocalMode ? "local file DB" : "Supabase"} (${
    requested || "auto"
  })`
);

module.exports = { isLocalMode, hasSupabaseConfig };
