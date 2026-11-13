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

export function fetchEvents() {
  return request("/events");
}
