const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const options = { auth: { autoRefreshToken: false, persistSession: false } };

const admin = createClient(url, serviceKey, options);
const anon = anonKey ? createClient(url, anonKey, options) : admin;

module.exports = { admin, anon };
