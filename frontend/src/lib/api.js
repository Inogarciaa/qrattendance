const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");

const STORAGE_KEY = "lacoqr.session";

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const session = loadSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the API. Is the backend running on port 3000?");
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function fetchMe() {
  return request("/auth/me");
}

export function fetchPrograms() {
  return request("/programs");
}

export function fetchOrganizers() {
  return request("/admin/organizers");
}

export function createEvent(payload) {
  return request("/events", { method: "POST", body: payload });
}

/** Partial update; only the fields present are written. */
export function updateEvent(id, payload) {
  return request(`/events/${id}`, { method: "PUT", body: payload });
}

export function fetchEvents() {
  return request("/events");
}

export function fetchEvent(id) {
  return request(`/events/${id}`);
}

export function fetchLiveDashboard() {
  return request("/dashboard/live");
}

export function searchStudents({ q = "", programId = "", status = "" } = {}) {
  const params = new URLSearchParams();
  if (String(q).trim()) params.set("q", String(q).trim());
  if (programId) params.set("program_id", programId);
  if (status) params.set("status", status);
  const query = params.toString();
  return request(`/admin/students${query ? `?${query}` : ""}`);
}

/** Self sign-ups (students and organizers) waiting for an admin decision. */
export function fetchApprovals() {
  return request("/admin/approvals");
}

/**
 * Approves a pending account, optionally correcting its role or department.
 * Rejecting deletes the account so the same school ID can be used again.
 */
export function setAccountApproval(id, { approved, role, programId } = {}) {
  const body = { approved };
  if (role) body.role = role;
  if (programId !== undefined) body.program_id = programId;
  return request(`/admin/accounts/${id}/approval`, { method: "PATCH", body });
}

export function fetchStudentAttendance(id) {
  return request(`/admin/students/${id}/attendance`);
}

/* ------------------------------------- temporary organizer access (0008) */

export function fetchTempOrganizers(eventId) {
  return request(`/admin/events/${eventId}/temp-organizers`);
}

export function addTempOrganizer(eventId, profileId) {
  return request(`/admin/events/${eventId}/temp-organizers`, {
    method: "POST",
    body: { profile_id: profileId },
  });
}

export function removeTempOrganizer(eventId, profileId) {
  return request(`/admin/events/${eventId}/temp-organizers/${profileId}`, {
    method: "DELETE",
  });
}

/** Students who asked to run the scanner for an event. */
export function fetchOrganizerRequests(status = "pending") {
  return request(`/admin/organizer-requests?status=${encodeURIComponent(status)}`);
}

export function decideOrganizerRequest(id, approved) {
  return request(`/admin/organizer-requests/${id}`, {
    method: "PATCH",
    body: { approved },
  });
}

/* ----------------------------------------- saved officer groups (0009) */

export function fetchOfficerGroups() {
  return request("/admin/officer-groups");
}

export function createOfficerGroup({ name, note = "", profileIds = [] }) {
  return request("/admin/officer-groups", {
    method: "POST",
    body: { name, note, profile_ids: profileIds },
  });
}

export function updateOfficerGroup(id, { name, note, profileIds } = {}) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (note !== undefined) body.note = note;
  if (profileIds !== undefined) body.profile_ids = profileIds;
  return request(`/admin/officer-groups/${id}`, { method: "PUT", body });
}

export function deleteOfficerGroup(id) {
  return request(`/admin/officer-groups/${id}`, { method: "DELETE" });
}

/** Gives every member of a group temporary gatekeeper access to one event. */
export function addTempOrganizerGroup(eventId, groupId) {
  return request(`/admin/events/${eventId}/temp-organizers/group`, {
    method: "POST",
    body: { group_id: groupId },
  });
}

export function fetchReports(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return request(`/reports${query ? `?${query}` : ""}`);
}

/* ------------------------------------- archive / restore (0011, superadmin) */

/** entity is one of: events, students, groups. */
export function fetchArchive(entity, query = "") {
  const params = new URLSearchParams({ entity });
  if (String(query).trim()) params.set("q", String(query).trim());
  return request(`/admin/archive?${params.toString()}`);
}

export function archiveEntity(entity, id) {
  return request(`/admin/archive/${entity}/${id}`, { method: "POST" });
}

export function restoreEntity(entity, id) {
  return request(`/admin/archive/${entity}/${id}/restore`, { method: "POST" });
}

/* ------------------------------------------ staff accounts (superadmin) */

export function fetchStaff() {
  return request("/admin/staff");
}

export function createStaffAccount({ fullName, email, password }) {
  return request("/admin/staff", {
    method: "POST",
    body: { full_name: fullName, email, password },
  });
}
