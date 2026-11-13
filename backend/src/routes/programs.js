const express = require("express");
const { admin } = require("../lib/supabase");
const { requireAuth } = require("../middleware/auth");
const { isLocalMode } = require("../lib/mode");
const { listPrograms } = require("../lib/local-db");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  if (isLocalMode) return res.json({ programs: listPrograms() });

  const { data, error } = await admin.from("programs").select("id, code, name").order("code");
  if (error) throw error;
  res.json({ programs: data });
});

module.exports = router;
