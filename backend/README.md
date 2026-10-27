# AttendX Backend

Express API layer over Supabase (Postgres + Auth + Realtime + Storage) for the dynamic QR
attendance system. Serves the admin web app and the organizer / student mobile apps.

## Stack

- Node.js + Express 5 (`src/index.js`)
- Supabase (`@supabase/supabase-js`, service-role for writes, anon for sign-in)
- Rotating QR tokens with a 30-second TTL, validated strictly server-side

## Structure

```text
src/
├── lib/            # Supabase clients and login helpers
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

**Role note:** the current API supports `admin`, `organizer`, and `student`. The
requested `superadmin` role requires the schema/RLS update described in
`docs/DATA_MODEL.md` before it can be used.

## Setup

1. Create a Supabase project.
2. Run the SQL in order in the SQL editor (or via Supabase CLI):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/seed.sql`
3. In `backend/`, copy `.env.example` to `.env` and fill in the project URL and keys.
4. Install and seed:

```bash
npm install
npm run seed     # creates sample admin, organizers, students and one live event
npm run dev      # http://localhost:3000
```

## Accounts

Accounts are school-ID based. The password is derived as
`digits(school_id) + YYYYMMDD(birthdate)`.

Example: school ID `2023-0142`, birthdate `2003-04-12` → password `2023014220030412`.

An identifier is mapped to a synthetic Auth email `digits(school_id)@lccb.local`
(domain configurable via `AUTH_EMAIL_DOMAIN`).

`npm run seed` prints the generated logins.

## Roles

| Role | App | Capabilities |
| --- | --- | --- |
| `admin` | web | manage events, import users, reports, dashboard |
| `organizer` | mobile | scan students at assigned events, drive the event display |
| `student` | mobile | show personal QR, self check-in |

## Dynamic QR tokens

- `POST /api/tokens/student` → rotating token for the student's personal QR (30s TTL).
- `POST /api/tokens/display` → rotating token for the projected event QR (30s TTL).
- Validation rejects anything past `expires_at` (0% acceptance for expired tokens).
- Every accept/reject is written to `scan_attempts` for security auditing.

## Endpoints

Base path: `/api`. All routes except `/auth/*` require `Authorization: Bearer <access_token>`.

### Auth

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | body `{ school_id, birthdate }` → session tokens |
| POST | `/auth/refresh` | public | body `{ refresh_token }` |
| GET | `/auth/me` | any | current profile |

### Tokens

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | `/tokens/student` | student | issue personal rotating token |
| POST | `/tokens/display` | admin, organizer | body `{ event_id }` → event display token |

### Scanning

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | `/scan/preview` | admin, organizer | body `{ event_id, token }` → student profile + photo, predicted status |
| POST | `/scan/confirm` | admin, organizer | body `{ event_id, token }` → commits gatekeeper attendance |
| POST | `/scan/self-checkin` | student | body `{ event_id, token }` → self-service attendance |

### Events

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | `/events` | any | scoped list by role |
| GET | `/events/:id` | any | detail + tally + summary |
| POST | `/events` | admin | create (accepts `organizer_ids`, `program_ids`) |
| PUT | `/events/:id` | admin | update |
| PUT | `/events/:id/organizers` | admin | replace organizers |
| PUT | `/events/:id/audiences` | admin | replace audience programs |
| POST | `/events/:id/close` | admin | aggregate, mark absents, write summary |

### Admin

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| POST | `/admin/import/students` | admin | body `{ rows: [...] }` |
| POST | `/admin/import/organizers` | admin | body `{ rows: [...] }` |
| GET | `/admin/students` | admin | search students (`q`, `program_id`) |
| GET | `/admin/students/:id/attendance` | admin | attendance history |

Import row shape:

```json
{ "school_id": "2024-0500", "full_name": "Juan Dela Cruz", "birthdate": "2004-05-01",
  "program_code": "BSIT", "year_level": 2, "photo_url": "https://..." }
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
