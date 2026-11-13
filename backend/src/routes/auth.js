const express = require("express");
const { anon } = require("../lib/supabase");
const { toEmail, buildPassword } = require("../lib/password");
const { requireAuth } = require("../middleware/auth");
const { isLocalMode } = require("../lib/mode");
const { signToken } = require("../lib/auth-token");
const { loginWithPassword } = require("../lib/local-db");

const router = express.Router();

function sessionResponse(user, session) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token ?? null,
    expires_at: session.expires_at ?? null,
    user,
  };
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

  const { admin } = require("../lib/supabase");
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, school_id, full_name, role, program_id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) return res.status(403).json({ error: "Profile not provisioned" });
  if (!profile.is_active) return res.status(403).json({ error: "Account disabled" });

  res.json(
    sessionResponse({ ...profile, email: data.user.email ?? profile.school_id }, data.session)
  );
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

  const { admin } = require("../lib/supabase");
  const { data: profile } = await admin
    .from("profiles")
    .select("id, school_id, full_name, role, program_id, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  res.json(
    sessionResponse(
      profile
        ? { ...profile, email: data.user.email ?? profile.school_id }
        : { id: data.user.id, school_id: String(school_id), email: data.user.email },
      data.session
    )
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

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
