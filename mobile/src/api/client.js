import { Platform } from "react-native";

import { getItem, removeItem, setItem } from "../lib/storage";
import { formatClock, formatEventDate, formatTimeRange, formatTimestamp } from "../lib/format";

/**
 * HTTP boundary for the LacoQR API.
 *
 * Nothing in here is mocked: every function talks to the Express backend, which
 * in turn talks to Supabase. Screens never call `fetch` directly.
 */

const SESSION_KEY = "lacoqr.session";
const API_BASE_KEY = "lacoqr.apiBase";

const STORAGE_PREFIX = "LQ";
export const STUDENT_QR_PREFIX = `${STORAGE_PREFIX}-STU`;
export const EVENT_QR_PREFIX = `${STORAGE_PREFIX}-EVT`;

/** Accepts "host:3000", "http://host:3000" or a full ".../api" URL. */
export function normalizeApiBase(value) {
  let base = String(value || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
  if (!/\/api$/i.test(base)) base = `${base}/api`;
  return base;
}

const ENV_BASE = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL);

// An Android emulator reaches the host machine through 10.0.2.2, not localhost.
const FALLBACK_BASE =
  Platform.OS === "android" ? "http://10.0.2.2:3000/api" : "http://localhost:3000/api";

let apiBase = ENV_BASE || FALLBACK_BASE;
let session = null;

export function getApiBase() {
  return apiBase;
}

export async function setApiBase(value) {
  const next = normalizeApiBase(value);
  apiBase = next || FALLBACK_BASE;
  await setItem(API_BASE_KEY, apiBase);
  return apiBase;
}

/** Loads the server URL saved on this device, if any. */
export async function loadApiBase() {
  const stored = await getItem(API_BASE_KEY);
  if (stored) apiBase = normalizeApiBase(stored) || apiBase;
  return apiBase;
}

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/* ------------------------------------------------------------------ session */

export function getSession() {
  return session;
}

async function persistSession(next) {
  session = next;
  if (next) await setItem(SESSION_KEY, JSON.stringify(next));
  else await removeItem(SESSION_KEY);
}

export async function restoreSession() {
  const raw = await getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    session = JSON.parse(raw);
    return session;
  } catch {
    session = null;
    await removeItem(SESSION_KEY);
    return null;
  }
}

export async function clearSession() {
  await persistSession(null);
  // Drop the Supabase session too, otherwise the next boot would adopt it again.
  const { supabase, supabaseConfigured } = await import("../lib/supabase");
  if (supabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Offline or already signed out; the API session is what matters.
    }
  }
}

/* ------------------------------------------------------------------ mapping */

function mapUser(profile) {
  if (!profile) return null;
  const programCode = profile.program?.code || "";
  const programName = profile.program?.name || programCode;

  return {
    id: profile.id,
    role: profile.role,
    name: profile.full_name || profile.school_id || profile.email || "Account",
    schoolId: profile.school_id || "",
    program: programName,
    programCode,
    programId: profile.program_id ?? null,
    yearLevel: profile.year_level ?? null,
    email: profile.email || "",
    photoUrl: profile.photo_url || null,
    active: profile.is_active !== false,
  };
}

const CLOSED_STATUSES = new Set(["completed", "cancelled", "closed"]);

/**
 * Collapses the API's event status into the three states the app renders.
 * "live" comes from the server, which evaluates the Asia/Manila window.
 */
function mapStatus(event) {
  if (event.live) return "live";
  if (CLOSED_STATUSES.has(event.status)) return "closed";
  return "upcoming";
}

function mapEvent(event) {
  const tally = event.tally || { present: 0, late: 0, absent: 0 };
  const status = mapStatus(event);
  const enrolled = event.enrolled ?? 0;
  const present = tally.present || 0;
  const late = tally.late || 0;
  // A scheduled event has no "absent" students yet, they simply have not arrived.
  const started = status !== "upcoming";
  const absent = started ? Math.max(0, enrolled - present - late) : 0;

  return {
    id: event.id,
    title: event.name,
    description: event.description || "",
    venue: event.venue || "",
    dateISO: String(event.event_date || "").slice(0, 10),
    date: formatEventDate(event.event_date),
    startTime: event.start_time || "",
    endTime: event.end_time || "",
    time: formatTimeRange(event.start_time, event.end_time),
    status,
    rawStatus: event.status,
    scanMode: event.scan_mode,
    qrWindowSeconds: event.qr_window_seconds || 30,
    present,
    late,
    absent,
    enrolled,
  };
}

function mapAttendance(record) {
  const event = record.event || {};
  return {
    id: record.id,
    status: record.status,
    method: record.method || "",
    scannedAt: record.scanned_at,
    timeIn: formatTimestamp(record.scanned_at) || formatClock(event.start_time),
    title: event.name || "Event",
    venue: event.venue || "",
    date: formatEventDate(event.event_date),
    dateISO: String(event.event_date || "").slice(0, 10),
  };
}

/* ------------------------------------------------------------------ request */

async function refreshSession() {
  if (!session?.refresh_token) return false;

  try {
    const response = await fetchWithTimeout(`${apiBase}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) return false;

    const data = await response.json();
    await persistSession({
      ...session,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? session.refresh_token,
      expires_at: data.expires_at ?? session.expires_at,
    });
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function request(path, { method = "GET", body, auth = true } = {}, retry = true) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  let response;
  try {
    response = await fetchWithTimeout(`${apiBase}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      `Can't reach the server at ${apiBase}. Check the Server URL and that the API is running.`,
      0
    );
  }

  if (response.status === 401 && auth && retry) {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, { method, body, auth }, false);
    await clearSession();
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status, data);
  }

  return data;
}

/* --------------------------------------------------------------------- auth */

/**
 * Turns a Supabase session into the shape this app stores. The API accepts the
 * same access token the Supabase client already holds.
 */
function adoptSupabaseSession(next) {
  if (!next?.access_token) return null;
  return {
    access_token: next.access_token,
    refresh_token: next.refresh_token ?? null,
    expires_at: next.expires_at ?? null,
    user: null,
  };
}

async function persistSupabaseSession() {
  const { supabase } = await import("../lib/supabase");
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  const adopted = adoptSupabaseSession(data?.session);
  if (adopted) await persistSession(adopted);
  return adopted;
}

export async function loginWithEmail({ email, password }) {
  const data = await request("/auth/login", {
    method: "POST",
    body: { email: String(email).trim(), password },
    auth: false,
  });

  const user = mapUser(data.user);
  if (!user) throw new ApiError("The server did not return an account.");
  if (user.role !== "student" && user.role !== "organizer") {
    throw new ApiError(
      "This app is for students and organizers. Use the web dashboard for staff accounts.",
      403
    );
  }

  await persistSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    user,
  });

  return session;
}

/**
 * Opens Google in the system browser, then stores the resulting session.
 * Web builds let Supabase handle the redirect, so the session is picked up on
 * the next boot instead.
 */
export async function signInWithGoogle() {
  const { supabase, supabaseConfigured } = await import("../lib/supabase");
  if (!supabaseConfigured) {
    throw new ApiError("Google sign-in is not configured in this build.");
  }

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: globalThis.location?.origin },
    });
    if (error) throw new ApiError(error.message);
    return null;
  }

  const Linking = await import("expo-linking");
  const WebBrowser = await import("expo-web-browser");

  const redirectTo = Linking.createURL("auth-callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new ApiError(error.message);
  if (!data?.url) throw new ApiError("Google did not return a sign-in URL.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) {
    throw new ApiError("Google sign-in was cancelled.", 499);
  }

  const match = String(result.url).match(/[?&]code=([^&]+)/);
  if (!match) throw new ApiError("Google did not return an authorization code.");

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    decodeURIComponent(match[1])
  );
  if (exchangeError) throw new ApiError(exchangeError.message);

  const adopted = await persistSupabaseSession();
  if (!adopted) throw new ApiError("Could not start a session from Google.");
  return adopted;
}

/** Restores a Google session that Supabase finished after a web redirect. */
export async function adoptPendingSupabaseSession() {
  const { supabase, supabaseConfigured } = await import("../lib/supabase");
  if (!supabaseConfigured) return null;

  const { data } = await supabase.auth.getSession();
  if (!data?.session) return null;

  const adopted = adoptSupabaseSession(data.session);
  if (adopted) await persistSession(adopted);
  return adopted;
}

/**
 * Reads the account behind the current token. Unlike fetchMe it also reports
 * sign-ups that still need a profile or an admin approval.
 */
export async function fetchAccount() {
  const data = await request("/auth/me");
  const user = mapUser(data.user);

  if (session && data.status === "ready" && user) {
    session = { ...session, user };
    await persistSession(session);
  }

  return {
    user,
    status: data.status || (user ? "ready" : "onboarding"),
    email: data.email || user?.email || "",
  };
}

export async function completeOnboarding(payload) {
  return request("/auth/onboarding", { method: "POST", body: payload });
}

/**
 * Remembers which button the person pressed before the Google handshake, so the
 * onboarding form opens as a student or an organizer even after a web redirect.
 */
const SIGNUP_ROLE_KEY = "lacoqr.signupRole";

export async function setIntendedRole(role) {
  if (role === "student" || role === "organizer") {
    await setItem(SIGNUP_ROLE_KEY, role);
  } else {
    await removeItem(SIGNUP_ROLE_KEY);
  }
}

export async function getIntendedRole() {
  const role = await getItem(SIGNUP_ROLE_KEY);
  return role === "organizer" ? "organizer" : "student";
}

export async function clearIntendedRole() {
  await removeItem(SIGNUP_ROLE_KEY);
}

export async function forgotPassword(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: { email: String(email).trim() },
    auth: false,
  });
}

export async function resetPassword({ email, code, password }) {
  const data = await request("/auth/reset-password", {
    method: "POST",
    body: { email: String(email).trim(), code: String(code).trim(), password },
    auth: false,
  });

  // The API hands back a ready session so the user lands signed in.
  if (data?.access_token) {
    await persistSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      user: null,
    });
  }

  return data;
}

export async function login({ schoolId, birthdate }) {
  const data = await request("/auth/login", {
    method: "POST",
    body: { school_id: schoolId, birthdate },
    auth: false,
  });

  const user = mapUser(data.user);
  if (!user) throw new ApiError("The server did not return an account.");

  if (user.role !== "student" && user.role !== "organizer") {
    throw new ApiError("This app is for students and organizers. Use the web dashboard for staff accounts.", 403);
  }

  await persistSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    user,
  });

  return session;
}

export async function fetchMe() {
  const account = await fetchAccount();
  return account.user;
}


/* ------------------------------------------------------------------- events */

export async function getEvents() {
  const data = await request("/events?with_counts=1");
  return (data.events || []).map(mapEvent).sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

export async function getEvent(eventId) {
  const data = await request(`/events/${eventId}`);
  return {
    ...mapEvent(data.event),
    enrolled: data.enrolled ?? data.event?.enrolled ?? 0,
    raw: data.event,
  };
}

export async function getMyAttendance() {
  const data = await request("/reports/me");
  return (data.records || []).map(mapAttendance);
}

/* ------------------------------------------------------------------- tokens */

/** Personal QR for the logged-in student. */
export async function issueStudentToken() {
  return request("/tokens/student", { method: "POST", body: {} });
}

/** Rotating QR projected by the organizer for self-service check-in. */
export async function issueEventToken(eventId) {
  return request("/tokens/display", { method: "POST", body: { event_id: eventId } });
}

export function buildStudentQrPayload(token) {
  return `${STUDENT_QR_PREFIX}:${token}`;
}

export function buildEventQrPayload(eventId, token) {
  return `${EVENT_QR_PREFIX}:${eventId}:${token}`;
}

/** Reads a scanned personal QR. Returns null for event codes. */
export function parseStudentQr(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value.startsWith(`${EVENT_QR_PREFIX}:`)) return null;
  if (value.startsWith(`${STUDENT_QR_PREFIX}:`)) {
    return value.slice(STUDENT_QR_PREFIX.length + 1) || null;
  }
  return value;
}

/** Reads a scanned event QR. Returns null for personal codes. */
export function parseEventQr(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  if (value.startsWith(`${EVENT_QR_PREFIX}:`)) {
    const [, eventId, token] = value.split(":");
    if (!eventId || !token) return null;
    return { eventId, token };
  }

  // Older/diagnostic payloads used "<event id>:<token>".
  const legacy = value.match(/^([0-9a-fA-F-]{36}):(.+)$/);
  if (legacy) return { eventId: legacy[1], token: legacy[2] };

  return null;
}

/* ----------------------------------------------------------------- scanning */

export async function previewScan({ eventId, token }) {
  return request("/scan/preview", {
    method: "POST",
    body: { event_id: eventId, token },
  });
}

export async function confirmScan({ eventId, token }) {
  return request("/scan/confirm", {
    method: "POST",
    body: { event_id: eventId, token },
  });
}

/**
 * Self check-in. `location` is optional: when it carries a fix the API also
 * checks the venue geofence, and a missing fix is accepted but flagged.
 */
export async function selfCheckIn({ eventId, token, location = null }) {
  const body = { event_id: eventId, token };

  if (location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
    body.latitude = location.latitude;
    body.longitude = location.longitude;
    if (typeof location.accuracy === "number") body.accuracy = location.accuracy;
    if (location.mocked) body.mocked = true;
  }

  return request("/scan/self-checkin", { method: "POST", body });
}

/* -------------------------------------------------------------------- misc */

/** Used by the login screen to verify a newly entered server URL. */
export async function fetchHealth() {
  return request("/health", { auth: false });
}
