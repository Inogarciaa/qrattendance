const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const { admin, anon, url, anonKey } = require("../lib/supabase");
const { toEmail, buildPassword } = require("../lib/password");
const { requireAccount } = require("../middleware/auth");
const { isLocalMode } = require("../lib/mode");
const { signToken } = require("../lib/auth-token");
const { loginWithPassword } = require("../lib/local-db");
const { hasApprovalColumn } = require("../lib/schema");

const router = express.Router();

const PROFILE_SELECT =
  "id, school_id, full_name, role, program_id, year_level, photo_url, is_active, email, program:programs(id, code, name)";

function sessionResponse(user, session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token ?? null,
    expires_at: session.expires_at ?? null,
    user,
  };
}

function accountState(profile) {
  if (!profile) return "onboarding";
  if (!profile.is_active && !profile.approved_at) return "pending";
  if (!profile.is_active) return "disabled";
  return "ready";
}

/** "20230142" and "2023-0142" both become "2023-0142". Anything else is rejected. */
function normalizeSchoolId(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^(\d{4})(\d{4})$/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function parseBirthdate(value) {
  const text = String(value || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== text) return null;

  const now = new Date();
  const age = (now - date) / (1000 * 60 * 60 * 24 * 365.25);
  if (age < 10 || age > 100) return null;

  return text;
}

async function loadProfile(userId) {
  const withApproval = await hasApprovalColumn();
  const { data, error } = await admin
    .from("profiles")
    .select(withApproval ? `${PROFILE_SELECT}, approved_at` : PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, approved_at: data.approved_at ?? null } : null;
}

async function emailLogin(req, res) {
  const { email, password } = req.body;

  if (isLocalMode) {
    const user = loginWithPassword(email, password);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    return res.json(sessionResponse(user, signToken(user)));
  }

  const { data, error } = await anon.auth.signInWithPassword({
    email: String(email).trim(),
    password,
  });
  if (error || !data?.session) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const profile = await loadProfile(data.user.id);
  return respondWithProfile(res, profile, data);
}

async function schoolIdLogin(req, res) {
  const { school_id, birthdate } = req.body;

  let password;
  try {
    password = buildPassword(school_id, birthdate);
  } catch {
    return res.status(400).json({ error: "Invalid birthdate" });
  }

  if (isLocalMode) {
    const user = loginWithPassword(toEmail(school_id), password);
    if (!user) return res.status(401).json({ error: "Invalid school ID or birthdate" });
    return res.json(sessionResponse(user, signToken(user)));
  }

  const { data, error } = await anon.auth.signInWithPassword({
    email: toEmail(school_id),
    password,
  });

  if (error || !data?.session) {
    return res.status(401).json({ error: "Invalid school ID or birthdate" });
  }

  const profile = await loadProfile(data.user.id);
  return respondWithProfile(res, profile, data);
}

/** Shared by both password logins: block unapproved and disabled accounts. */
function respondWithProfile(res, profile, data) {
  if (!profile) {
    return res.status(403).json({
      error: "Profile not provisioned",
      code: "profile_missing",
    });
  }
  if (!profile.is_active && !profile.approved_at) {
    return res.status(403).json({
      error: "Your account is waiting for admin approval",
      code: "pending_approval",
    });
  }
  if (!profile.is_active) {
    return res.status(403).json({ error: "Account disabled", code: "account_disabled" });
  }

  return res.json(
    sessionResponse({ ...profile, email: data.user.email ?? profile.email ?? profile.school_id }, data.session)
  );
}

router.post("/login", async (req, res) => {
  const body = req.body || {};
  if (body.email && body.password) return emailLogin(req, res);
  if (body.school_id && body.birthdate) return schoolIdLogin(req, res);
  return res
    .status(400)
    .json({ error: "email and password (or school_id and birthdate) are required" });
});

router.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body || {};
  if (isLocalMode) {
    return res.status(400).json({ error: "Refresh is not available in local mode" });
  }
  if (!refresh_token) return res.status(400).json({ error: "refresh_token is required" });

  const { data, error } = await anon.auth.refreshSession({ refresh_token });
  if (error || !data?.session) {
    return res.status(401).json({ error: "Unable to refresh session" });
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
});

/**
 * Works for every session, including Google sign-ups that have not created a
 * profile yet, so the app can route to onboarding or the approval screen.
 */
router.get("/me", requireAccount, async (req, res) => {
  const state = accountState(req.user);
  const email = req.authUser?.email ?? req.user?.email ?? null;

  if (!req.user) return res.json({ user: null, status: state, email });

  res.json({
    user: { ...req.user, email: req.user.email ?? email },
    status: state,
    email,
  });
});

/** Self sign-up never creates staff accounts; those are imported by an admin. */
const SIGNUP_ROLES = ["student", "organizer"];

/**
 * Completes a Google sign-up: the auth user exists, the profile does not.
 * New accounts stay pending until an admin approves them.
 *
 * Students also pick a year level; organizers only pick the department they
 * work with. The department is profile metadata, not a geofence or event rule.
 */
router.post("/onboarding", requireAccount, async (req, res) => {
  if (isLocalMode) {
    return res.status(501).json({ error: "Sign-up needs Supabase mode" });
  }
  if (req.user) {
    return res.status(409).json({ error: "This account already has a profile" });
  }

  const body = req.body || {};

  const role = String(body.role || "student").trim().toLowerCase();
  if (!SIGNUP_ROLES.includes(role)) {
    return res.status(400).json({
      error: "Choose whether you are signing up as a student or an organizer",
      code: "invalid_role",
    });
  }

  const schoolId = normalizeSchoolId(body.school_id);
  if (!schoolId) {
    return res.status(400).json({ error: "Use a school ID in the form 2023-0142" });
  }

  const fullName = String(body.full_name || "").trim();
  if (fullName.length < 2 || fullName.length > 120) {
    return res.status(400).json({ error: "Enter your full name" });
  }

  const birthdate = parseBirthdate(body.birthdate);
  if (!birthdate) {
    return res.status(400).json({ error: "Enter a valid birthdate (YYYY-MM-DD)" });
  }

  let yearLevel = null;
  if (role === "student") {
    yearLevel = Number(body.year_level);
    if (!Number.isInteger(yearLevel) || yearLevel < 1 || yearLevel > 6) {
      return res.status(400).json({ error: "Choose your year level" });
    }
  }

  const programCode = String(body.program_code || "").trim().toUpperCase();
  const { data: program, error: programError } = await admin
    .from("programs")
    .select("id, code")
    .ilike("code", programCode)
    .maybeSingle();
  if (programError) throw programError;
  if (!program) {
    return res.status(400).json({
      error: role === "organizer" ? "Choose your department" : "Choose your program",
    });
  }

  const { data: taken, error: takenError } = await admin
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (takenError) throw takenError;
  if (taken) {
    return res.status(409).json({
      error: `${schoolId} is already registered. Sign in with your school ID instead.`,
      code: "school_id_taken",
    });
  }

  const withApproval = await hasApprovalColumn();
  const { error: insertError } = await admin.from("profiles").insert({
    id: req.authUser.id,
    school_id: schoolId,
    full_name: fullName,
    email: req.authUser.email ?? null,
    role,
    program_id: program.id,
    year_level: yearLevel,
    birthdate,
    is_active: false,
    ...(withApproval ? { approved_at: null } : {}),
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return res.status(409).json({
        error: "That school ID or email is already registered.",
        code: "already_registered",
      });
    }
    throw insertError;
  }

  return res.status(201).json({ status: "pending", user: null });
});

/**
 * Emails a 6-digit recovery code. Always answers the same way so the endpoint
 * cannot be used to discover which addresses have accounts.
 */
router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }

  if (isLocalMode) {
    return res.status(501).json({ error: "Password reset needs Supabase mode" });
  }

  const { error } = await anon.auth.resetPasswordForEmail(email);
  if (error) {
    if (/rate|too many|after \d+ seconds/i.test(error.message)) {
      return res.status(429).json({
        error: "A code was just sent. Wait a minute before asking for another.",
        code: "rate_limited",
      });
    }
    console.warn("[auth] resetPasswordForEmail failed:", error.message);
  }

  res.json({ ok: true });
});

/** Verifies the emailed code and sets the new password in one step. */
router.post("/reset-password", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").replace(/\s/g, "");
  const password = String(req.body?.password || "");

  if (!email || !code) {
    return res.status(400).json({ error: "Enter the code from your email" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Use at least 8 characters" });
  }
  if (isLocalMode) {
    return res.status(501).json({ error: "Password reset needs Supabase mode" });
  }

  // A dedicated client keeps the recovery session off the shared anon client.
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await client.auth.verifyOtp({
    email,
    token: code,
    type: "recovery",
  });

  if (error || !data?.session) {
    const expired = /expired|invalid/i.test(error?.message || "");
    return res.status(400).json({
      error: expired
        ? "That code is invalid or has expired. Request a new one."
        : "Could not verify that code.",
      code: "invalid_code",
    });
  }

  const { error: updateError } = await client.auth.updateUser({ password });
  if (updateError) {
    return res.status(400).json({ error: updateError.message, code: "weak_password" });
  }

  return res.json({
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
});

module.exports = router;
