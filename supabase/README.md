# LacoQR Database

PostgreSQL schema for the dynamic QR attendance system, designed for Supabase.
This folder defines the database only; the API in `backend/` talks to it.

## Files

| File | Purpose |
| --- | --- |
| `migrations/0001_schema.sql` | enums, tables, indexes, helper functions |
| `migrations/0002_rls.sql` | Row Level Security policies + read grants |
| `migrations/0003_superadmin.sql` | `superadmin` enum value + admin-equivalent policies |
| `migrations/0004_profiles_email.sql` | `profiles.email` + unique index (email search) |
| `migrations/0005_signup_approval.sql` | `profiles.approved_at` for the Google sign-up approval queue |
| `migrations/0006_geofence.sql` | venue coordinates on `events`, location evidence on `attendance` |
| `migrations/0007_avatars.sql` | public `avatars` storage bucket for optional profile photos |
| `migrations/0008_temp_organizers.sql` | event-scoped gatekeeper grants (`event_temp_organizers`) and student requests (`organizer_requests`) |
| `migrations/0009_officer_groups.sql` | saved officer groups (`officer_groups`, `officer_group_members`) for one-step gatekeeper assignment |
| `seed.sql` | default programs (SBIT, ARFIEN, SSLATE, SHTM) |
| `apply_all.sql` | all nine migrations + `seed.sql` in one paste-and-run script |

Apply in order (`0001` → `0002` → `0003` → `0004` → `0005` → `0006` → `0007` → `0008` → `0009` → `seed.sql`)
in the Supabase SQL editor, or via the Supabase CLI:

```bash
supabase db push
```

`apply_all.sql` is the fastest path for a fresh project: open the SQL editor, paste the
whole file, run it once. All statements are idempotent, so re-running is safe.

> **Next migration:** `0010_alignment.sql` is planned. It should add token hashing,
> year-level audiences, `report_exports`, and `audit_logs`. See `docs/DATA_MODEL.md`.

Restart the API after applying a migration that adds a column or table (`0004`, `0005`,
`0006`, `0008`, `0009`).
PostgREST caches the table schema, so new columns stay invisible to the API until
its connection is recreated.

## Seeding accounts

The SQL only creates programs. Accounts, the sample event and its audiences come from
the API:

```bash
cd backend
npm run seed
```

That creates the superadmin/admin (email + password from `.env`), two organizers, five
students, and a `Sample Seminar` event dated to the current **Asia/Manila** day.

## Enumerated types

| Type | Values |
| --- | --- |
| `user_role` | admin, superadmin, organizer, student |
| `scan_mode` | gatekeeper, self_service, dual |
| `event_status` | draft, scheduled, live, completed, cancelled |
| `attendance_status` | present, late, absent |
| `scan_method` | gatekeeper, self_service |
| `token_subject` | student, event |

## Tables

### `programs`
Academic programs used as the attendance audience.

| Column | Type | Notes |
| --- | --- | --- |
| id | serial | PK |
| code | text | unique, e.g. `SBIT` |
| name | text | |

### `profiles`
One row per account; extends `auth.users`.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | PK, references `auth.users(id)` |
| school_id | text | unique login identifier |
| full_name | text | |
| email | text | login email; unique when set (`0004`) |
| role | user_role | default `student` |
| program_id | int | FK → programs |
| year_level | int | |
| birthdate | date | part of the login password |
| photo_url | text | optional profile photo; public URL in the `avatars` bucket (`0007`) |
| is_active | boolean | default true |
| approved_at | timestamptz | null while a self-signup waits for an admin (`0005`) |
| created_at | timestamptz | |

### `events`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| name, description, venue | text | |
| event_date | date | |
| start_time, end_time | time | |
| grace_minutes | int | late threshold, default 15 |
| scan_mode | scan_mode | default gatekeeper |
| status | event_status | default scheduled |
| qr_window_seconds | int | token TTL, default 30 |
| latitude, longitude | double precision | venue pin for the self check-in fence (`0006`); null = no fence |
| geofence_radius_m | int | metres around the pin, default 100 (`0006`) |
| created_by | uuid | FK → profiles |
| created_at | timestamptz | |

### `event_organizers`
Many-to-many: organizers assigned to an event. PK `(event_id, profile_id)`.

### `event_audiences`
Many-to-many: programs expected at an event. Drives the "Enrolled" denominator.
PK `(event_id, program_id)`.

### `event_temp_organizers`
Event-scoped gatekeeper grants for **student** accounts (`0008`). A student keeps
their own QR, self check-in and history; they just gain the scanner for one event.

| Column | Type | Notes |
| --- | --- | --- |
| event_id | uuid | PK part, FK → events (cascade) |
| profile_id | uuid | PK part, FK → profiles (cascade) |
| expires_at | timestamptz | event end + 60 minutes in `Asia/Manila`, enforced per request |
| granted_by | uuid | FK → profiles (admin who granted it) |
| created_at | timestamptz | |

Keeping grants in their own table means `PUT /events/:id/organizers` (which replaces the
permanent organizer list) cannot wipe them. No cron job is needed: every scan re-checks
`expires_at`.

### `organizer_requests`
A student asking to work the scanner for one event (`0008`). Approving creates the
matching `event_temp_organizers` row.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| event_id | uuid | FK → events (cascade) |
| profile_id | uuid | FK → profiles (cascade) |
| note | text | optional message to the admin |
| status | text | `pending` / `approved` / `declined` |
| decided_by | uuid | FK → profiles (admin) |
| decided_at | timestamptz | |
| created_at | timestamptz | |

A partial unique index on `(event_id, profile_id) WHERE status = 'pending'` allows one
open request per student and event; decided rows stay as history.

### `qr_tokens`
Server-issued rotating tokens (30s TTL).

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| subject_type | token_subject | student or event |
| subject_id | uuid | profile id or event id |
| token | text | unique |
| issued_at | timestamptz | |
| expires_at | timestamptz | validated strictly |
| consumed_at | timestamptz | null until used |

### `attendance`
One record per student per event (`UNIQUE(event_id, student_id)`).

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | PK |
| event_id | uuid | FK → events |
| student_id | uuid | FK → profiles |
| status | attendance_status | present / late / absent |
| method | scan_method | null for absent |
| scanned_at | timestamptz | |
| scanned_by | uuid | FK → profiles (organizer) |
| token_id | uuid | FK → qr_tokens |
| distance_m | numeric | metres from the venue pin at self check-in (`0006`) |
| accuracy_m | numeric | the fix's own error radius (`0006`) |
| location_verified | boolean | true = inside fence, false = allowed but flagged, null = no fence (`0006`) |
| location_mocked | boolean | device reported a simulated location (`0006`) |

### `scan_attempts`
Audit log of accepted and rejected scans (supports the 0%-expired-token metric).
`reason` carries the token outcomes (`expired`, `consumed`, `not_found`, …), the two
location outcomes — `out_of_area` (rejected) and `location_unverified` (accepted,
flagged) — and `self_scan` when a temporary gatekeeper tries to record their own
attendance at their own gate.

### `event_summaries`
Aggregated totals per event, written when an event is closed.

## Storage

`0007_avatars.sql` creates one public bucket:

| Bucket | Public | Contents |
| --- | --- | --- |
| `avatars` | yes | `<user id>/avatar.{jpg,png,webp}` — optional profile photos |

The bucket is public only for reads, so a plain URL renders in the mobile app and the web
dashboard. There is no insert/update/delete policy: uploads and deletions go through
`POST`/`DELETE /auth/photo` in the API, which uses the service role. The API removes the
old file when the extension changes and appends `?v=<timestamp>` to the stored URL so the
new picture appears immediately. Removing a photo deletes the object and nulls
`profiles.photo_url`, which falls back to the initials avatar.

## Relationships

```
programs 1─┬─< profiles
           └─< event_audiences >─┐
events 1─┬─< event_organizers >─┤
         ├─< event_audiences  >─┘
         ├─< attendance >─────── profiles
         ├─< event_temp_organizers >─ profiles   (0008, expires_at)
         ├─< organizer_requests >──── profiles   (0008, status)
         ├─< qr_tokens (subject)
         └─1 event_summaries
profiles 1─< attendance, scan_attempts, events.created_by
```

## Indexes

Primary keys and unique constraints are automatic. Additional indexes:
`profiles(program_id, role)`, `events(event_date, status)`,
`event_organizers(profile_id)`, `event_audiences(program_id)`,
`attendance(event_id, student_id, event_id+status)`,
`qr_tokens(token, subject_type+subject_id)`, `scan_attempts(event_id, attempted_at)`,
`event_temp_organizers(profile_id, expires_at)` (`0008`),
`organizer_requests(status, created_at)` plus the pending-only unique index (`0008`).

## Security (RLS)

Row Level Security is enabled on every table. Writes are intentionally **not** granted to
clients — insert/update/delete run through the service role (the API layer) once connected.

- **student** — own profile, events for their program, own attendance; own
  `event_temp_organizers` rows and own `organizer_requests`
- **organizer** — assigned events, student profiles, attendance for assigned events
- **admin** — full event/report access, including grant/revoke and request decisions
- **superadmin** — same as admin (account management stays API/service-role only)

`0008` also lets an active temporary gatekeeper read the granted event and its
attendance rows, even when the event is not in their program's audience. The mobile app
goes through the API; this policy is defense in depth.

## Helper functions

- `current_role()` — caller's role (security definer)
- `current_program()` — caller's program id
- `is_admin()` — true for `admin` and `superadmin`

## Note on auth

`profiles.id` references `auth.users(id)` (Supabase Auth). The schema targets Supabase;
on plain PostgreSQL the `auth.users` reference and the two helper functions must be adapted.

## Google sign-in and email delivery

Two dashboard settings make student self sign-up and password reset work. Neither
touches the schema, so they cannot be applied with SQL.

### 1. Google provider

1. In Google Cloud Console, create an **OAuth client ID** of type *Web application*.
2. Add `https://<project-ref>.supabase.co/auth/v1/callback` to **Authorized redirect
   URIs**. This is Supabase's callback, not the app's.
3. In Supabase → **Authentication → Sign In / Providers → Google**, paste the client
   ID and secret and enable the provider. Leave *Skip nonce checks* off.
4. In Supabase → **Authentication → URL Configuration**, add the app's redirect URLs:
   - `lacoqr://auth-callback` (installed/dev build)
   - `exp://127.0.0.1:8081/--/auth-callback` (Expo Go on the same machine; the exact
     `exp://` URL is printed by Metro and also appears on the app's sign-in error)
   - `http://localhost:8081/**` and `http://localhost:5173/**` for web builds

The app uses the **PKCE** flow, so no client secret is shipped in the mobile bundle.

### 2. Custom SMTP + recovery template

Supabase's built-in sender is rate-limited and often lands in spam, so the project
uses Gmail SMTP with an app password:

- Supabase → **Authentication → Emails → SMTP Settings**: host `smtp.gmail.com`,
  port `465`, sender = the Gmail address, password = a 16-character Google **app
  password** (not the account password).
- Under **Authentication → Emails → Templates → Reset password**, make sure the body
  prints the numeric code. Supabase provides `{{ .Token }}` for this:

  ```html
  <p>Your LacoQR verification code is:</p>
  <h2 style="letter-spacing:6px">{{ .Token }}</h2>
  <p>It expires in an hour. If you did not ask for this, ignore this email.</p>
  ```

  The default template links to `{{ .ConfirmationURL }}` instead; that link works in
  a browser but the mobile app needs the six digits. Keep both if you want either
  flow to work.

The app never sees the SMTP credentials. `POST /auth/forgot-password` asks Supabase to
send the mail, and `POST /auth/reset-password` verifies the code with
`verifyOtp({ type: "recovery" })` before setting the new password.
