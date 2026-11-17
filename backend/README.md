# LacoQR Backend

Express API layer over Supabase (Postgres + Auth + Realtime + Storage) for the dynamic QR
attendance system. Serves the admin web app and the organizer / student mobile apps.

## Stack

- Node.js + Express 5 (`src/index.js`)
- Supabase (`@supabase/supabase-js`, service-role for writes, anon for sign-in)
- Rotating QR tokens with a 30-second TTL, validated strictly server-side

## Structure

```text
src/
├── lib/            # Supabase clients, local dev DB, tokens, login helpers
├── middleware/     # bearer auth + role guard
├── routes/         # endpoint definitions
├── services/       # token and attendance business rules
└── index.js        # Express bootstrap
scripts/
└── seed.js         # demo accounts + sample event
```

Route files contain the request handling for now. If a route grows past roughly
250 lines, move its logic into a `controllers/` file and keep the route as a thin
mapping. See `docs/FOLDER_STRUCTURE.md` for the project-wide conventions.

**Role note:** the API supports `admin`, `superadmin`, `organizer`, and `student`.
`superadmin` is added by `supabase/migrations/0003_superadmin.sql` and passes every
`admin` guard.

## Data mode (Supabase or local file DB)

`DATA_MODE` in `backend/.env` picks the data source explicitly:

| `DATA_MODE` | Behaviour |
| --- | --- |
| `supabase` | always use Supabase; the API refuses to boot if the URL/keys are missing |
| `local` | always use `backend/data/local-db.json` |
| empty / unset | auto-detect: Supabase if real credentials are present, otherwise local |

The old heuristic (treating `https://your-project.supabase.co` as "local") still
applies as a safety net in auto mode. At boot the API logs the resolved source:

```text
[mode] data source: Supabase (supabase)
```

### Local development mode

When the resolved mode is `local`, the API uses a file-backed database at
`backend/data/local-db.json` (gitignored). It seeds programs, staff, organizers,
and students on first use. `npm run seed` prints the accounts.

## Health check

`GET /api/health` answers "is this thing actually connected?":

```json
{ "status": "ok", "mode": "supabase", "database": "ok",
  "supabase_url": "https://<ref>.supabase.co", "time": "..." }
```

- `database: "ok"` — a real query (`select id from programs limit 1`) succeeded.
- `database: "schema-missing-or-unreachable"` — credentials work but the tables
  are missing, i.e. the migrations in `supabase/` were never applied. Responds 503.
- `database: "local-db.json"` — running in local mode.

API responses are sent with `Cache-Control: no-store` and Express ETags are
disabled, so polling clients always see fresh attendance instead of a 304.

## Setup

1. Create a Supabase project.
2. Run the SQL in order in the SQL editor (or via Supabase CLI):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_superadmin.sql`
   - `supabase/migrations/0004_profiles_email.sql`
   - `supabase/migrations/0005_signup_approval.sql`
   - `supabase/migrations/0006_geofence.sql`
   - `supabase/migrations/0007_avatars.sql`
   - `supabase/migrations/0008_temp_organizers.sql`
   - `supabase/seed.sql`

   Or paste the combined `supabase/apply_all.sql` once — it contains all eight
   migrations plus the seed programs.

   Restart the API after applying `0005`/`0006`/`0008`: PostgREST caches the
   table/column list, so new ones are invisible until the connection is
   recreated. (The API also degrades gracefully meanwhile — see *Migrations are
   optional* below.)
3. In `backend/`, copy `.env.example` to `.env`, fill in the project URL and keys,
   and set `DATA_MODE=supabase`.
4. Install and seed:

```bash
npm install
npm run seed     # creates sample admin, organizers, students and one live event
npm run dev      # http://localhost:3000
```

Then confirm with `curl http://localhost:3000/api/health`.

## Accounts

Staff (superadmin and admin) sign in to the web dashboard with **email + password**.
`npm run seed` creates the configured superadmin and admin accounts and prints
their credentials.

Mobile accounts remain school-ID based. The password is derived as
`digits(school_id) + YYYYMMDD(birthdate)`.

Example: school ID `2023-0142`, birthdate `2003-04-12` → password `2023014220030412`.

An identifier is mapped to a synthetic Auth email `digits(school_id)@lccb.local`
(domain configurable via `AUTH_EMAIL_DOMAIN`).

Students and organizers may also sign up with Google (`/auth/onboarding`); staff
accounts stay email + password. Either way, a forgotten password is reset with a
6-digit code emailed from the Supabase project's custom SMTP server (Gmail + app
password). Codes come from `/auth/forgot-password` and are exchanged at
`/auth/reset-password`; nothing is stored on our side.

`npm run seed` prints the generated logins.

## Roles

| Role | App | Capabilities |
| --- | --- | --- |
| `superadmin` | web | everything an admin can do; manages admin accounts |
| `admin` | web | manage events, import users, reports, dashboard |
| `organizer` | mobile | scan students at assigned events, drive the event display |
| `student` | mobile | show personal QR, self check-in |

## Dynamic QR tokens

- `POST /api/tokens/student` → rotating token for the student's personal QR (30s TTL).
- `POST /api/tokens/display` → rotating token for the projected event QR (30s TTL).
- Validation rejects anything past `expires_at` (0% acceptance for expired tokens).
- Every accept/reject is written to `scan_attempts` for security auditing.

## Temporary organizer access (migration 0008)

Sometimes the person running the scanner is a student. Flipping
`profiles.role` would take away their personal QR, self check-in and history, so
the grant is **event-scoped** instead:

- `event_temp_organizers` — `(event_id, profile_id)` with `expires_at`, computed
  as the event end plus one hour in `Asia/Manila`. It lives in its own table so
  `PUT /events/:id/organizers` (which replaces the permanent list) cannot wipe it.
- `organizer_requests` — one pending request per student and event. Approving it
  creates the grant; declining just closes the request.
- `canScan()` checks permanent organizers first, then an unexpired grant, so
  `/scan/preview`, `/scan/confirm` and `/tokens/display` accept a grant-holder
  without a role change. Expiry is enforced per request; no cron job is needed.
- `GET /events?scope=organizing` is what the mobile gatekeeper screen uses. It
  returns only events with an active grant and includes `grant_expires_at`.
- A grant-holder cannot record their own attendance through their own scanner
  (`reason: "self_scan"`).
- A gatekeeper-mode event does **not** need a permanent organizer. The create form
  accepts a temporary organizer alone (`event_organizers` empty, one grant), which
  suits a council officer covering a single event; it only refuses an event with
  neither. `canScan()` does not care which of the two paths granted access.

Until `0008` is applied, these endpoints answer
`503 { code: "migration_required" }`, `canScan()` ignores grants, and the
dashboard/mobile entry points stay hidden.

#### Geofencing (migration 0006)

Self check-in has **two** gates: the rotating token *and* the venue fence. Gatekeeper
scanning keeps its single gate — the organizer looking at the student — and is never
blocked by location.

- `events.latitude` / `events.longitude` are optional. Without them there is no fence,
  so every event created before the migration behaves exactly as it did.
  `events.geofence_radius_m` defaults to 100 m and is validated to 25–1000 m.
- The admin places the pin on an OpenStreetMap/Leaflet map (or types the coordinates)
  in **Create Event**, and can move it later with **Change location** on the
  dashboard. Both use `PUT /events/:id`.
- `POST /scan/self-checkin` accepts `{ latitude, longitude, accuracy, mocked }`:
  - a trustworthy fix inside the radius → saved with `location_verified = true`, plus
    `distance_m` and `accuracy_m`;
  - no fix, `accuracy > 50 m`, or `mocked: true` → **accepted but flagged**
    (`location_verified = false`, `reason = location_unverified`). Locking a student
    out over a bad fix inside a concrete building is the worse failure;
  - a trustworthy fix beyond the radius → `403 { code: "out_of_area", distance_m,
    radius_m }`, logged in `scan_attempts`.
- Gatekeeper rows and `absent` rows written when an event closes leave the location
  columns null — the app does not record an organizer's position.
- `GET /reports/export` adds `Location Verified`, `Distance (m)` and `Accuracy (m)`.
- `npm run geo:check` runs the Haversine and boundary assertions in
  `scripts/check-geo.js`; the project has no test runner, so it is a plain Node script.

If `0006_geofence.sql` has not been applied, the API logs a warning, selects events
without the geo fields and skips the fence. Creating or editing an event with
coordinates answers `503 { code: "migration_required" }`.

## Endpoints

Base path: `/api`. All routes except `/auth/*` require `Authorization: Bearer <access_token>`.

### Auth

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | body `{ email, password }` (staff) or `{ school_id, birthdate }` (mobile) → session tokens |
| POST | `/auth/refresh` | public | body `{ refresh_token }` (Supabase mode only) |
| GET | `/auth/me` | any session | `{ user, status, email }` where `status` is `ready`, `onboarding`, `pending`, or `disabled` |
| POST | `/auth/onboarding` | Google session without a profile | body `{ role, school_id, full_name, birthdate, program_code, year_level? }` → creates a **pending** profile. `role` is `student` or `organizer` (staff roles are refused); organizers skip `year_level` and store their department in `program_id` |
| POST | `/auth/forgot-password` | public | body `{ email }` → emails a 6-digit recovery code (always answers `{ ok: true }`) |
| POST | `/auth/reset-password` | public | body `{ email, code, password }` → verifies the code, sets the password, returns a ready session |
| POST | `/auth/photo` | approved account | body `{ image: "data:image/jpeg;base64,..." }` (≤ 3 MB) → stores it in the public `avatars` bucket and returns `{ photo_url }` |
| DELETE | `/auth/photo` | approved account | removes the stored file and clears `photo_url` |

Profile photos are optional. The bucket is public so the URL renders anywhere;
uploads always go through this endpoint with the service role.

Login answers with `403` and a `code` when the account cannot be used yet:
`profile_missing`, `pending_approval`, or `account_disabled`. The mobile app uses
those codes to route to onboarding or the waiting screen.

## Sign-up and approval

Anyone with a Google account can install the app and sign up. The login screen has
two sign-up buttons, **Sign up as student** and **Sign up as organizer**, so the
form knows which fields to ask for before the OAuth handshake. The flow is:

1. The app runs the Supabase Google OAuth handshake (PKCE) and gets a session.
2. `GET /auth/me` reports `status: "onboarding"` because no profile exists yet.
3. `POST /auth/onboarding` creates a profile with `is_active = false` and
   `approved_at = NULL`. Students send a year level; organizers send only their
   department (stored in `program_id`). `GET /auth/me` now reports
   `status: "pending"`.
4. An admin approves from the web dashboard's **Approvals** page
   (`PATCH /admin/accounts/:id/approval` with `{ approved: true, role?, program_id? }`),
   which sets `is_active = true` and stamps `approved_at`. The optional role and
   department correct a wrong button press in the same call.
5. The next `GET /auth/me` reports `status: "ready"` and the app opens.

Rejecting (`{ approved: false }`) deletes the Supabase auth user; the profile goes
with it through the FK cascade, so the school ID can be used again.

The organizer department is profile metadata only: it never selects a geofence and
never assigns events. Fences are chosen per event by the admin.

`GET /admin/approvals` returns the queue (`{ approvals, approvals_enabled }`) for
both roles, oldest first.

Pending accounts do not affect attendance numbers: `audienceSize()` only counts
`is_active = true` profiles.

If `0005_signup_approval.sql` has not been applied, the API logs a warning, keeps
serving existing accounts as approved, and answers approval requests with
`503 { code: "migration_required" }`.

### Tokens

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | `/tokens/student` | student | issue personal rotating token |
| POST | `/tokens/display` | admin, organizer, active temp grant | body `{ event_id }` → event display token |

### Scanning

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | `/scan/preview` | admin, organizer, active temp grant | body `{ event_id, token }` → student profile + photo, predicted status |
| POST | `/scan/confirm` | admin, organizer, active temp grant | body `{ event_id, token }` → commits gatekeeper attendance (rejects the scanner's own token) |
| POST | `/scan/self-checkin` | student | body `{ event_id, token, latitude?, longitude?, accuracy?, mocked? }` → self-service attendance (fence applied when the event has coordinates) |

### Events

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | `/events` | any | scoped list by role; `?scope=organizing` returns the events this account has an active gatekeeper grant for |
| GET | `/events/:id` | staff, assigned organizer, audience student, active temp grant | detail + tally + enrolled audience count + `my_access` |
| POST | `/events` | admin | create (accepts `organizer_ids`, `temp_organizer_ids`, `program_ids`, `latitude`, `longitude`, `geofence_radius_m`) |
| PUT | `/events/:id` | admin | update (same fields; send `latitude`/`longitude` as `null` to clear the fence) |
| PUT | `/events/:id/organizers` | admin | replace organizers |
| PUT | `/events/:id/audiences` | admin | replace audience programs |
| POST | `/events/:id/close` | admin | aggregate, mark absents, write summary |
| POST | `/events/:id/organizer-request` | student | ask to run the scanner for this event (`{ note? }`) |
| DELETE | `/events/:id/organizer-request` | student | cancel my pending request |

### Admin

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | `/admin/import/students` | admin | body `{ rows: [...] }` |
| POST | `/admin/import/organizers` | admin | body `{ rows: [...] }` |
| GET | `/admin/organizers` | admin | list active organizers for event assignment |
| GET | `/admin/students` | admin | search students by name, school ID, or email (`q`, `program_id`, `status=pending\|active`) |
| GET | `/admin/approvals` | admin | self sign-ups (students and organizers) with `approved_at IS NULL` → `{ approvals, approvals_enabled }` |
| PATCH | `/admin/accounts/:id/approval` | admin | body `{ approved, role?, program_id? }` — approve (optionally correcting role/department) or delete a pending signup |
| GET | `/admin/students/:id/attendance` | admin | attendance history |
| GET | `/admin/events/:id/temp-organizers` | admin | active temporary gatekeepers for an event |
| POST | `/admin/events/:id/temp-organizers` | admin | body `{ profile_id }` — grant a student scanner access until an hour after the event |
| DELETE | `/admin/events/:id/temp-organizers/:profileId` | admin | revoke a grant |
| GET | `/admin/organizer-requests` | admin | pending (`?status=`) student requests → `{ requests }` |
| PATCH | `/admin/organizer-requests/:id` | admin | body `{ approved }` — approve (creates the grant) or decline |

Import row shape:

```json
{ "school_id": "2024-0500", "full_name": "Juan Dela Cruz", "birthdate": "2004-05-01",
  "program_code": "SBIT", "year_level": 2, "photo_url": "https://..." }
```

### Reports & Dashboard

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | `/reports` | admin | filters: `event_id`, `status`, `program_id`, `from`, `to` |
| GET | `/reports/export` | admin | same filters → CSV download |
| GET | `/dashboard/live` | admin | live events with tallies and recent scans |
| GET | `/programs` | any | list programs |

## Realtime

Clients may subscribe to `public.attendance` inserts (RLS-scoped) for the live dashboard.
The table is added to the `supabase_realtime` publication by `0001_schema.sql`.

## Notes

- `end_time` must be after `start_time`.
- Status is `late` when a scan happens after `start_time + grace_minutes`, otherwise `present`.
- Absent records are generated when an event is closed.
- Photos (`photo_url`) can point to Supabase Storage for gatekeeper verification.
