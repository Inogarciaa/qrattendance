const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { staffAccounts } = require("./staff-accounts");

const DB_PATH =
  process.env.LOCAL_DB_PATH || path.join(__dirname, "../../data/local-db.json");

const DEFAULT_STAFF_PASSWORD = "LacoQR@2026";

const PROGRAMS = [
  { code: "BSIT", name: "BS Information Technology" },
  { code: "BSBA", name: "BS Business Administration" },
  { code: "BSED", name: "BS Education" },
];

const PEOPLE = [
  ...staffAccounts(),
  {
    school_id: "ORG-0001",
    full_name: "Rafael Dizon",
    email: "organizer1@lacoqr.local",
    role: "organizer",
    password: DEFAULT_STAFF_PASSWORD,
    program_code: "BSIT",
  },
  {
    school_id: "ORG-0002",
    full_name: "Bea Villanueva",
    email: "organizer2@lacoqr.local",
    role: "organizer",
    password: DEFAULT_STAFF_PASSWORD,
    program_code: "BSBA",
  },
  {
    school_id: "2023-0142",
    full_name: "Maria Santos",
    email: "student1@lacoqr.local",
    role: "student",
    password: DEFAULT_STAFF_PASSWORD,
    program_code: "BSIT",
  },
  {
    school_id: "2023-0157",
    full_name: "Jose Ramirez",
    email: "student2@lacoqr.local",
    role: "student",
    password: DEFAULT_STAFF_PASSWORD,
    program_code: "BSIT",
  },
  {
    school_id: "2024-0210",
    full_name: "Angela Cruz",
    email: "student3@lacoqr.local",
    role: "student",
    password: DEFAULT_STAFF_PASSWORD,
    program_code: "BSBA",
  },
  {
    school_id: "2023-0318",
    full_name: "Kristine Lopez",
    email: "student4@lacoqr.local",
    role: "student",
    password: DEFAULT_STAFF_PASSWORD,
    program_code: "BSED",
  },
];

let cache = null;

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    password_salt: salt,
    password_hash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };
}

function verifyPassword(password, account) {
  if (!account?.password_hash || !account?.password_salt) return false;
  const actual = crypto.scryptSync(password, account.password_salt, 64);
  const expected = Buffer.from(account.password_hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function emptyDb() {
  return { programs: [], accounts: [], events: [] };
}

function seed(db) {
  let changed = false;

  for (const program of PROGRAMS) {
    if (!db.programs.some((item) => item.code === program.code)) {
      const id = db.programs.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      db.programs.push({ id, ...program });
      changed = true;
    }
  }

  const programByCode = Object.fromEntries(
    db.programs.map((program) => [program.code, program.id])
  );

  for (const person of PEOPLE) {
    if (db.accounts.some((account) => account.email === person.email)) continue;
    db.accounts.push({
      id: crypto.randomUUID(),
      school_id: person.school_id,
      full_name: person.full_name,
      email: person.email,
      role: person.role,
      program_id: person.program_code ? programByCode[person.program_code] : null,
      is_active: true,
      created_at: new Date().toISOString(),
      ...hashPassword(person.password),
    });
    changed = true;
  }

  return changed;
}

function load() {
  if (cache) return cache;

  try {
    cache = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    cache = emptyDb();
  }

  if (seed(cache)) save();
  return cache;
}

function save() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

function publicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    school_id: account.school_id,
    full_name: account.full_name,
    email: account.email,
    role: account.role,
    program_id: account.program_id,
    is_active: account.is_active,
  };
}

function programById(id) {
  return load().programs.find((program) => program.id === id) ?? null;
}

function findAccountByEmail(email) {
  const needle = String(email || "").trim().toLowerCase();
  return load().accounts.find((account) => account.email.toLowerCase() === needle) ?? null;
}

function findAccountById(id) {
  return load().accounts.find((account) => account.id === id) ?? null;
}

function listAccounts(role) {
  return load()
    .accounts.filter((account) => account.role === role && account.is_active)
    .map((account) => ({
      ...publicAccount(account),
      program: account.program_id ? programById(account.program_id) : null,
    }));
}

function listPrograms() {
  return load().programs.map((program) => ({ ...program }));
}

function loginWithPassword(email, password) {
  const account = findAccountByEmail(email);
  if (!account || !account.is_active || !verifyPassword(password, account)) return null;
  return publicAccount(account);
}

function eventRow(event) {
  return {
    ...event,
    event_organizers: (event.organizer_ids || []).map((profile_id) => ({ profile_id })),
    event_audiences: (event.program_ids || []).map((program_id) => ({ program_id })),
  };
}

function createEvent(payload, createdBy) {
  const db = load();
  const event = {
    id: crypto.randomUUID(),
    name: payload.name,
    description: payload.description ?? null,
    venue: payload.venue,
    event_date: payload.event_date,
    start_time: payload.start_time,
    end_time: payload.end_time,
    grace_minutes: payload.grace_minutes ?? 15,
    scan_mode: payload.scan_mode ?? "gatekeeper",
    status: payload.status ?? "scheduled",
    qr_window_seconds: payload.qr_window_seconds ?? 30,
    created_by: createdBy,
    created_at: new Date().toISOString(),
    organizer_ids: Array.isArray(payload.organizer_ids) ? payload.organizer_ids : [],
    program_ids: Array.isArray(payload.program_ids) ? payload.program_ids : [],
  };
  db.events.push(event);
  save();
  return eventRow(event);
}

function listEvents() {
  return load()
    .events.slice()
    .sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)))
    .map(eventRow);
}

function getEvent(id) {
  const event = load().events.find((item) => item.id === id);
  return event ? eventRow(event) : null;
}

function updateEvent(id, payload) {
  const db = load();
  const event = db.events.find((item) => item.id === id);
  if (!event) return null;

  for (const key of [
    "name",
    "description",
    "venue",
    "event_date",
    "start_time",
    "end_time",
    "grace_minutes",
    "scan_mode",
    "status",
    "qr_window_seconds",
  ]) {
    if (payload[key] !== undefined) event[key] = payload[key];
  }
  if (Array.isArray(payload.organizer_ids)) event.organizer_ids = payload.organizer_ids;
  if (Array.isArray(payload.program_ids)) event.program_ids = payload.program_ids;

  save();
  return eventRow(event);
}

function seedLocalData() {
  const db = load();
  seed(db);
  save();
  return {
    accounts: PEOPLE.map((person) => ({
      email: person.email,
      role: person.role,
      full_name: person.full_name,
      password: person.password,
    })),
    programs: listPrograms(),
    events: listEvents(),
  };
}

module.exports = {
  DEFAULT_STAFF_PASSWORD,
  findAccountByEmail,
  findAccountById,
  getEvent,
  createEvent,
  listAccounts,
  listEvents,
  listPrograms,
  loginWithPassword,
  publicAccount,
  seedLocalData,
  updateEvent,
  verifyPassword,
};
