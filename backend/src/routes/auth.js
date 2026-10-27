const express = require("express");
const { anon } = require("../lib/supabase");
const { toEmail, buildPassword, toBirthdate } = require("../lib/password");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { school_id, birthdate } = req.body || {};
  if (!school_id || !birthdate) {
    return res.status(400).json({ error: "school_id and birthdate are required" });
  }

  let password;
  try {
    password = buildPassword(school_id, birthdate);
  } catch {
    return res.status(400).json({ error: "Invalid birthdate" });
  }

  const { data, error } = await anon.auth.signInWithPassword({
    email: toEmail(school_id),
    password,
  });

  if (error || !data?.session) {
    return res.status(401).json({ error: "Invalid school ID or birthdate" });
  }

  res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user.id, school_id: String(school_id) },
  });
});

router.post("/refresh", async (req, res) => {
  const { refresh_token } = req.body || {};
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
