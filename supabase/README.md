# AttendX Database

PostgreSQL schema for the dynamic QR attendance system, designed for Supabase.
Nothing is wired up yet — this only defines the database.

## Files

| File | Purpose |
| --- | --- |
| `migrations/0001_schema.sql` | enums, tables, indexes, helper functions |
| `migrations/0002_rls.sql` | Row Level Security policies + read grants |
| `seed.sql` | default programs (BSIT, BSBA, BSED) |

Apply in order (`0001` → `0002` → `seed.sql`) in the Supabase SQL editor, or via the
Supabase CLI:

```bash
supabase db push
```

> **Next migration:** `0003_alignment.sql` is planned but not applied yet. It
> should add the `superadmin` role, token hashing, year-level audiences,
> `report_exports`, and `audit_logs`. See `docs/DATA_MODEL.md`.

## Enumerated types

| Type | Values |
| --- | --- |
| `user_role` | admin, organizer, student (proposed: + superadmin) |
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
| code | text | unique, e.g. `BSIT` |
| name | text | |

### `profiles`
One row per account; extends `auth.users`.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | PK, references `auth.users(id)` |
| school_id | text | unique login identifier |
| full_name | text | |
| role | user_role | default `student` |
| program_id | int | FK → programs |
| year_level | int | |
| birthdate | date | part of the login password |
| photo_url | text | for gatekeeper verification |
| is_active | boolean | default true |
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
| created_by | uuid | FK → profiles |
| created_at | timestamptz | |

### `event_organizers`
Many-to-many: organizers assigned to an event. PK `(event_id, profile_id)`.

### `event_audiences`
Many-to-many: programs expected at an event. Drives the "Enrolled" denominator.
PK `(event_id, program_id)`.

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

### `scan_attempts`
Audit log of accepted and rejected scans (supports the 0%-expired-token metric).

### `event_summaries`
Aggregated totals per event, written when an event is closed.

## Relationships

```
programs 1─┬─< profiles
           └─< event_audiences >─┐
events 1─┬─< event_organizers >─┤
         ├─< event_audiences  >─┘
         ├─< attendance >─────── profiles
         ├─< qr_tokens (subject)
         └─1 event_summaries
profiles 1─< attendance, scan_attempts, events.created_by
```

## Indexes

Primary keys and unique constraints are automatic. Additional indexes:
`profiles(program_id, role)`, `events(event_date, status)`,
`event_organizers(profile_id)`, `event_audiences(program_id)`,
`attendance(event_id, student_id, event_id+status)`,
`qr_tokens(token, subject_type+subject_id)`, `scan_attempts(event_id, attempted_at)`.

## Security (RLS)

Row Level Security is enabled on every table. Writes are intentionally **not** granted to
clients — insert/update/delete run through the service role (the API layer) once connected.

- **student** — own profile, events for their program, own attendance
- **organizer** — assigned events, student profiles, attendance for assigned events
- **admin** — full access

## Helper functions

- `current_role()` — caller's role (security definer)
- `current_program()` — caller's program id

## Note on auth

`profiles.id` references `auth.users(id)` (Supabase Auth). The schema targets Supabase;
on plain PostgreSQL the `auth.users` reference and the two helper functions must be adapted.
