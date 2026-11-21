const { admin } = require("../lib/supabase");
const { isLocalMode } = require("../lib/mode");
const { verifyToken } = require("../lib/auth-token");
const { findAccountById, publicAccount } = require("../lib/local-db");
const { hasApprovalColumn } = require("../lib/schema");

const PROFILE_SELECT =
  "id, school_id, full_name, role, program_id, year_level, photo_url, is_active, email, deleted_at, program:programs(id, code, name)";

function bearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

function deny(res, status, error, code) {
  return res.status(status).json({ error, code });
}

function loadLocalUser(token) {
  const payload = verifyToken(token);
  if (!payload) return null;
  const account = findAccountById(payload.sub);
  if (!account || !account.is_active) return null;
  return publicAccount(account);
}

/**
 * Resolves the bearer token to a Supabase auth user and, when one exists, the
 * matching profile. Used by endpoints that must work before a profile exists
 * (self sign-up onboarding) as well as after an account is approved.
 */
async function resolveAccount(req) {
  const token = bearer(req);
  if (!token) return { error: [401, "Missing bearer token", "missing_token"] };

  if (isLocalMode) {
    const user = loadLocalUser(token);
    if (!user) return { error: [401, "Invalid or expired token", "invalid_token"] };
    return { authUser: { id: user.id, email: user.email || null }, profile: user };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { error: [401, "Invalid or expired token", "invalid_token"] };

  const withApproval = await hasApprovalColumn();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(withApproval ? `${PROFILE_SELECT}, approved_at` : PROFILE_SELECT)
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  return {
    authUser: data.user,
    profile: profile ? { ...profile, approved_at: profile.approved_at ?? null } : null,
  };
}

/** Accepts any valid session, including accounts that have no profile yet. */
async function requireAccount(req, res, next) {
  try {
    const { error, authUser, profile } = await resolveAccount(req);
    if (error) return deny(res, ...error);
    req.authUser = authUser;
    req.user = profile || null;
    next();
  } catch (err) {
    next(err);
  }
}

/** Accepts only accounts with an approved, active profile. */
async function requireAuth(req, res, next) {
  try {
    const { error, authUser, profile } = await resolveAccount(req);
    if (error) return deny(res, ...error);

    if (!profile) {
      return deny(res, 403, "Finish setting up your profile first", "profile_missing");
    }
    // A self-signup keeps is_active = false until an admin approves it.
    if (!profile.is_active && !profile.approved_at) {
      return deny(res, 403, "Your account is waiting for admin approval", "pending_approval");
    }
    if (!profile.is_active) {
      return deny(res, 403, "This account has been disabled", "account_disabled");
    }
    if (profile.deleted_at) {
      return deny(res, 403, "This account has been archived", "account_archived");
    }

    req.authUser = authUser;
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

  // Soft-deleted profiles (archived) cannot use any role-guarded routes
  if (req.user?.deleted_at) {
    return res.status(403).json({ error: "Forbidden", code: "account_archived" });
  }

  if (!req.user || !allowed.has(req.user.role)) {
    return res.status(403).json({ error: "Forbidden", code: "forbidden" });
  }
  next();
};

module.exports = { requireAccount, requireAuth, requireRole };
