const express = require("express");
const { issueToken } = require("../services/tokens");
const { getEvent, canScan } = require("../services/attendance");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/student", requireAuth, requireRole("student"), async (req, res) => {
  const windowSeconds = 30;
  const token = await issueToken("student", req.user.id, windowSeconds);
  res.json({ subject: "student", student_id: req.user.id, ...token });
});

router.post("/display", requireAuth, requireRole("admin", "organizer"), async (req, res) => {
  const { event_id } = req.body || {};
  if (!event_id) return res.status(400).json({ error: "event_id is required" });

  const event = await getEvent(event_id);
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (!(await canScan(req.user, event_id))) {
    return res.status(403).json({ error: "You are not assigned to this event" });
  }

  const token = await issueToken("event", event_id, event.qr_window_seconds || 30);
  res.json({ subject: "event", event_id, ...token });
});

module.exports = router;
