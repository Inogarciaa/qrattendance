# Project Analysis

This document summarizes the thesis proposal and the supplied ERD, then turns
them into an implementation plan.

**Sources**

- `Dynamic QR Attendance.pdf` (8 pages)
- `erd-original.png` / the supplied `erd.pdf` (one-page ERD)

---

## 1. What the system is

AttendX is an event attendance platform for La Consolacion College Bacolod. It
replaces paper sign-in sheets and static QR codes with **rotating QR tokens** and
an optional **human verification step**.

Two clients share one cloud database:

1. **Web dashboard** — used by faculty/administrators to create events, project a
   live event QR code, monitor attendance in real time, and export reports.
2. **Mobile app** — used by students (show personal QR / scan event QR) and event
   organizers (scan student QR, inspect the student's photo and details, confirm
   or cancel).

A REST API sits between the clients and Supabase so that token validation,
role checks, and attendance writes happen on the server. The client is never
trusted to decide whether a token is valid or whether a student may check in.

### The problem being solved

- Manual sign-in causes entrance bottlenecks and slow record processing.
- Static QR codes can be screenshotted and shared, enabling proxy attendance.
- Organizers need to visually confirm that the person in front of them matches
  the student record before attendance is saved.
- Administrators need live counts and reports without re-typing data.

### Core idea

- Every student and every projected event display has a **dynamic QR token** that
  expires after **30 seconds**.
- The server validates the token's timestamp, subject, usage, and event rules.
- **Gatekeeper mode:** an organizer scans the student, sees the student's photo,
  name, ID number, and program, then confirms or cancels.
- **Self-service mode:** students scan the event QR shown on a projector/TV.
- **Dual mode:** both pathways are allowed for the same event.
- Attendance is recorded as **Present**, **Late**, or **Absent**, and reports can
  be exported after the event.

---

## 2. Users and responsibilities

| Role | Platform | Main responsibilities |
| --- | --- | --- |
| **Superadmin** | Web | Manage admin accounts, programs, global settings, and audit logs. View all events and reports. |
| **Admin** | Web | Create/edit/cancel events, set grace periods and scan modes, assign organizers and audiences, monitor live attendance, close events, export reports. |
| **Organizer** | Mobile | View assigned events, scan student QR codes, perform visual verification, confirm/cancel attendance, view event progress. |
| **Student** | Mobile | Log in, display a personal rotating QR code, scan an event display QR for self-service check-in, view personal attendance history. |

> The proposal and ERD define only `admin`, `organizer`, and `student`.
> **Superadmin is a new requirement** added for this build. It must be added to
> the database enum and RLS policies before use. See `docs/DATA_MODEL.md`.

---

## 3. Functional requirements

### 3.1 Authentication and accounts

| ID | Requirement |
| --- | --- |
| AUTH-01 | A user signs in with a school ID and birthdate (existing prototype behavior). The API derives the Supabase Auth email and initial password. |
| AUTH-02 | After login, the client receives an access token and the user's role/profile. The UI routes each role to the correct experience. |
| AUTH-03 | Inactive accounts cannot sign in or call protected endpoints. |
| AUTH-04 | Superadmin can create, deactivate, and reset admin/organizer/student accounts. |
| AUTH-05 | Students can see only their own profile and attendance; organizers see student data only for events they are assigned to. |

**Security note:** using a birthdate-derived password is convenient for a
campus prototype but is weak in production. A later version should use a random
temporary password or one-time code and force a password change on first login.

### 3.2 Event management (web)

| ID | Requirement |
| --- | --- |
| EVT-01 | Admin can create an event with name, description, venue, date, start/end time, grace period, scan mode, and QR refresh interval. |
| EVT-02 | Admin can edit a draft/scheduled event and cancel an event. |
| EVT-03 | Admin selects the audience by program and (recommended) year level. An empty audience means all programs. |
| EVT-04 | Admin assigns one or more organizers to an event. Only assigned organizers (or admins) can gatekeeper-scan that event. |
| EVT-05 | Admin can open a display terminal that continuously issues event tokens for self-service or dual mode. |
| EVT-06 | Admin can close an event. Closing generates Absent records for enrolled students and stores a summary. |

### 3.3 Mobile — student

| ID | Requirement |
| --- | --- |
| STU-01 | Student sees a personal QR code that refreshes automatically before its 30-second expiry. |
| STU-02 | Student can open a camera scanner to scan an event display QR. |
| STU-03 | Self-service check-in succeeds only when the event is live, uses self-service/dual mode, the student is in the audience, the token is fresh and unused, and no attendance record exists yet. |
| STU-04 | Student can view personal attendance history and status. |
| STU-05 | The app shows clear success, duplicate, expired, wrong-event, and not-in-audience messages. |

### 3.4 Mobile — organizer

| ID | Requirement |
| --- | --- |
| ORG-01 | Organizer sees only events assigned to them. |
| ORG-02 | Scanner pauses after reading a student token and shows a verification card: photo, full name, school ID, program, year level, predicted status, and duplicate warning. |
| ORG-03 | Organizer taps **Confirm Attendance** to save the record or **Cancel** to discard it. Cancellation is logged. |
| ORG-04 | Every scan attempt is logged with result/reason, scanner, event, student, device, and processing time. |
| ORG-05 | Organizer sees a live count of present/late/absent students for the event. |
| ORG-06 | Organizer cannot scan for an event they are not assigned to, and cannot use gatekeeper mode when the event is self-service only. |

### 3.5 Live monitoring and reports (web)

| ID | Requirement |
| --- | --- |
| RPT-01 | Dashboard lists live events with enrolled/present/late/absent counts and recent scans. |
| RPT-02 | New attendance records stream in without a page refresh (Supabase Realtime or polling fallback). |
| RPT-03 | Admin can search students by name or school ID and view attendance history. |
| RPT-04 | Admin can filter attendance by event, status, program, and date range. |
| RPT-05 | Admin can export the filtered result to CSV (and later XLSX/PDF). |
| RPT-06 | Each export is recorded in `report_exports` for auditability. |

### 3.6 Superadmin

| ID | Requirement |
| --- | --- |
| SUP-01 | Superadmin can list, create, deactivate, and reset admin accounts. |
| SUP-02 | Superadmin can manage academic programs and global settings (e.g., default QR interval, default grace period). |
| SUP-03 | Superadmin can view all events/reports and the audit trail of sensitive actions. |
| SUP-04 | Admin accounts cannot create or modify other admin/superadmin accounts. |

---

## 4. Business rules

1. **One attendance row per student per event** — enforced by
   `UNIQUE (event_id, student_id)`.
2. **Present vs Late** — a scan at or before `start_time + grace_minutes` is
   `present`; after that it is `late`. Absent rows are generated when the event is
   closed.
3. **Token lifetime** — student/display tokens expire after 30 seconds by
   default. The server clock is authoritative; expired tokens are always
   rejected.
4. **One active token per subject** — issuing a new student or event token
   replaces the previous one so old QR images stop working immediately.
5. **Token subject must match the operation** — a student token cannot be used as
   an event display token, and vice versa.
6. **Audience check** — an empty `event_audiences` set means the event is open to
   all programs; otherwise the student's program (and year level, if configured)
   must match.
7. **Organizer scope** — a gatekeeper scan is allowed only for an admin or an
   organizer assigned to that event.
8. **Self-service scope** — only a student may call self-check-in, and only for
   an event in `self_service` or `dual` mode.
9. **Duplicate scans** — a second check-in returns the existing record and does
   not overwrite the first scan time.
10. **Logging** — accepted, cancelled, expired, invalid, replayed, duplicate,
    unauthorized, not-in-audience, and event-closed attempts are all recorded.
11. **Event lifecycle** — `draft → scheduled → live → completed`, with
    `cancelled` as an exit path. The server should determine "live" from date/time
    as well as status.
12. **Photo data** — profile photos are used only for identity verification and
    must not be exposed to unauthenticated clients.

---

## 5. Non-functional requirements

| Area | Target |
| --- | --- |
| Verification speed | Under 3 seconds per gatekeeper scan (preview + confirm). |
| Token security | 0% acceptance of expired tokens during security testing. |
| QR rotation | 30 seconds, configurable per event; refresh client-side before expiry. |
| Real-time updates | Live dashboard reflects new check-ins within ~2 seconds. |
| Availability | Requires an internet connection; document offline behavior as a limitation. |
| Security | Supabase Auth, server-side authorization, RLS, HTTPS, least-privilege service key usage, hashed/opaque tokens. |
| Privacy | Students see only their own data; organizers see student data only for assigned events. |
| Auditability | Every scan attempt and every report export is traceable. |
| Usability | Mobile-first student/organizer screens; responsive admin dashboard; clear error states. |
| Maintainability | Feature-based folders, small modules, consistent naming, no duplicated code. |

---

## 6. Data needed (summary)

The complete data dictionary is in `docs/DATA_MODEL.md`. At a high level the
system needs:

- **Identity:** programs, profiles (with role, program, year level, photo,
  active flag), and Supabase Auth credentials.
- **Events:** event details, scan mode, grace period, status, creator, assigned
  organizers, and audience programs/year levels.
- **Security:** rotating QR tokens (student and event subjects), token expiry and
  consumption, and scan attempt logs.
- **Attendance:** one record per student per event with status, method, time,
  confirming organizer, and token reference.
- **Reporting:** per-event summaries and report export history.
- **Administration:** audit logs and global settings for superadmin.

---

## 7. Current repository status

| Area | What exists | What is missing |
| --- | --- | --- |
| Database | `programs`, `profiles`, `events`, `event_organizers`, `event_audiences`, `qr_tokens`, `attendance`, `scan_attempts`, `event_summaries`, RLS | `superadmin` role, audience year level, `report_exports`, `audit_logs`, token hashing |
| API | Auth, token issue, scan preview/confirm/self-check-in, events CRUD, imports, reports CSV, live dashboard | Superadmin endpoints, audience year level, export audit, realtime/WebSocket support |
| Web | Dashboard, reports, create-event, student search, settings, help UI | Real API integration, login, role guards, realtime data, superadmin screens |
| Mobile | Nothing yet | Entire Expo app (student QR/scanner, organizer scanner/verification) |

The current web pages use demo data from `frontend/src/lib/demo-data.js`. They are
useful for validating layout and flows, but they do not call the API yet.

### Known backend gaps found during code review

These are real issues to close before the system is considered feature-complete:

1. **Service-role bypasses RLS.** The API uses the Supabase service-role key for
   every query, so Postgres RLS does not protect route handlers. Each endpoint
   must perform its own role/assignment/audience checks.
2. **Event detail is not scoped.** `GET /api/events/:id` lets any authenticated
   user read any event. It should check admin/superadmin, assigned organizer, or
   student audience membership.
3. **Gatekeeper scan does not re-check liveness or audience.** `POST
   /api/scan/confirm` validates the token and duplicate state, but not whether the
   event is live or the student is in the audience. Move all checks into the
   confirm transaction.
4. **Organizer cancellation is not logged.** The ERD expects
   `cancelled_by_officer`; the current preview/confirm flow has no cancel
   endpoint or log entry.
5. **Report exports are not audited.** CSV export works, but no `report_exports`
   row is written.
6. **Raw tokens are stored.** `qr_tokens.token` and `scan_attempts.token` hold the
   raw value. Store a hash instead.
7. **All-program events are hidden from students.** `GET /api/events` uses an
   inner join on `event_audiences`, so an event with no audience rows (meaning
   "all programs") does not appear. Change the query or insert explicit audience
   rows.
8. **`/auth/me` returns the full profile.** It includes private fields such as
   `birthdate`. Return only the fields the client needs.
9. **No superadmin enforcement.** The role does not exist yet in the enum, RLS,
   or route guards.

---

## 8. Recommended build order

1. **Lock the data model** — apply the recommended schema changes, especially
   `superadmin`, audience year levels, token hashing, and report/audit tables.
2. **Authentication end-to-end** — login screen, token storage, `/auth/me`, role
   routing, and protected API calls.
3. **Admin event management** — real event list/create/edit, organizer and
   audience assignment, event detail page.
4. **Student mobile flow** — login, personal rotating QR, self-service scanner,
   attendance history.
5. **Organizer mobile flow** — assigned events, gatekeeper scanner, verification
   card, confirm/cancel.
6. **Display terminal** — full-screen event QR with 30-second rotation.
7. **Live dashboard and reports** — realtime updates, filters, CSV export, export
   audit.
8. **Superadmin** — admin management, programs, settings, audit log viewer.
9. **Hardening and evaluation** — expired-token tests, duplicate/replay tests,
   load test at the venue, usability test, and thesis metrics.

---

## 9. Key decisions and risks

| Decision / risk | Recommendation |
| --- | --- |
| `backend/` + `frontend/` vs. `apps/packages` | Keep `backend/`, `frontend/`, and add `mobile/`. It matches how beginners think and avoids workspace tooling. |
| UUIDs vs. integer IDs | Use UUIDs for Supabase-compatible records; keep integer IDs only for `programs`. |
| Birthdate-based password | Acceptable for the thesis prototype; replace with a temporary password + forced change before production. |
| Raw tokens stored in DB | Store a hash of the token and compare hashes; never log the raw token in production. |
| Supabase service key | Keep it server-side only; never expose it to the Vite or Expo client. |
| No internet | Document as a limitation; do not promise offline check-in. |
| Device clock skew | Always validate expiry on the server, not on the phone. |
| Photo privacy | Use signed URLs or an authenticated endpoint for student photos. |
| Demo data in the web app | Clearly isolated in `lib/demo-data.js`; replace feature by feature with API calls. |
