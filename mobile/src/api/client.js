/**
 * API boundary for LacoQR.
 *
 * Everything currently returns mock data after a short delay so the UI can be
 * built and reviewed without a backend. When the Express API is ready, replace
 * the bodies of these functions with `fetch` calls to the endpoints documented
 * below. No screen imports mock data directly — only this module does.
 */

import {
  attendanceHistory,
  demoUsers,
  events,
  scanCandidates,
  studentScanEvent,
} from "../mock/data";
import { makeMockToken } from "../lib/format";

const LATENCY = 450;

function delay(value, ms = LATENCY) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** POST /api/auth/login  { school_id, birthdate } */
export async function login({ role }) {
  return delay(demoUsers[role] || demoUsers.student);
}

/** POST /api/tokens/student  -> { token, expires_in } */
export async function issueStudentToken() {
  return delay({ token: makeMockToken("LQ-STU"), expiresIn: 30 }, 120);
}

/** GET /api/events  -> assigned events with counts */
export async function getEvents() {
  return delay(events.map((event) => ({ ...event })));
}

/** GET /api/reports/attendance/me  -> student's attendance history */
export async function getAttendanceHistory() {
  return delay(attendanceHistory.map((item) => ({ ...item })));
}

/** POST /api/scan/preview  { event_id, token } */
export async function previewScan({ candidateIndex = 0 } = {}) {
  const candidate = scanCandidates[candidateIndex % scanCandidates.length];
  return delay({ ...candidate, event: studentScanEvent });
}

/** POST /api/scan/confirm  { event_id, student_id } */
export async function confirmScan({ student }) {
  return delay({ ok: true, student, checkedInAt: new Date().toISOString() }, 550);
}
