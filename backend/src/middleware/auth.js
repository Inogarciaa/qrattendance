const { admin } = require("../lib/supabase");
const { isLocalMode } = require("../lib/mode");
const { verifyToken } = require("../lib/auth-token");
const { findAccountById, publicAccount } = require("../lib/local-db");

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

function loadLocalUser(token) {
  const payload = verifyToken(token);
  if (!payload) return null;
  const account = findAccountById(payload.sub);
  if (!account || !account.is_active) return null;
  return publicAccount(account);
}

async function requireAuth(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    if (isLocalMode) {
      const user = loadLocalUser(token);
      if (!user) return res.status(401).json({ error: "Invalid or expired token" });
      req.user = user;
      return next();
    }

    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid or expired token" });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return res.status(403).json({ error: "Profile not provisioned" });
    if (!profile.is_active) return res.status(403).json({ error: "Account disabled" });

    req.user = profile;
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole = (...roles) => (req, res, next) => {
  const allowed = new Set(roles);
  // A superadmin can do everything an admin can do.
  if (allowed.has("admin")) allowed.add("superadmin");

  if (!req.user || !allowed.has(req.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

module.exports = { requireAuth, requireRole };
