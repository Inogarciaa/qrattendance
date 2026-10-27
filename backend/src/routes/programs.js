const express = require("express");
const { admin } = require("../lib/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const { data, error } = await admin.from("programs").select("id, code, name").order("code");
  if (error) throw error;
  res.json({ programs: data });
});

module.exports = router;
