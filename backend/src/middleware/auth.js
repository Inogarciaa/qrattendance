const { admin } = require("../lib/supabase");

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

async function requireAuth(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

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
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

module.exports = { requireAuth, requireRole };
