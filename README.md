# LacoQR — Dynamic QR Attendance System

A real-time event attendance platform based on the thesis proposal
**"Real-Time Event Attendance Management System Using Dual Dynamic QR Codes with
Human-in-the-Loop Visual Verification."**

The system uses rotating QR codes (30-second lifetime), two scanning modes
(gatekeeper and self-service), and an organizer verification step before an
attendance record is saved. Self-service check-ins add a **venue geofence** as a
second gate: the rotating token proves the code is fresh, and the fence proves the
phone is at the event.

## Applications

| Folder | Application | Primary users |
| --- | --- | --- |
| `backend/` | Express REST API over Supabase | All clients |
| `frontend/` | React + Vite web dashboard | Superadmin, Admin |
| `mobile/` | Expo / React Native app (Expo Go) | Student, Organizer |
| `supabase/` | PostgreSQL schema, RLS policies, seed data | Developers |
| `docs/` | Analysis, data model, folder guide | Developers |

## Roles

| Role | Platform | Responsibility |
| --- | --- | --- |
| **Superadmin** | Web | Manage admins, programs, global settings, audit logs, and all events/reports. |
| **Admin** | Web | Create events, assign organizers and audiences, monitor live attendance, export reports. |
| **Organizer** | Mobile | Scan student QR codes at assigned events and confirm identity visually. |
| **Student** | Mobile | Display a personal rotating QR code and self-scan event QR codes. |

> The thesis document defines `admin`, `organizer`, and `student`. **Superadmin**
> is an addition requested for this implementation and is documented in
> `docs/DATA_MODEL.md`.

## Quick start

### 1. Database

1. Create a Supabase project.
2. Run the SQL files in order in the Supabase SQL editor:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_superadmin.sql`
   - `supabase/migrations/0004_profiles_email.sql`
   - `supabase/migrations/0005_signup_approval.sql`
   - `supabase/migrations/0006_geofence.sql`
   - `supabase/seed.sql`

   Or paste the combined `supabase/apply_all.sql` once in the SQL editor.
3. Enable **Google** sign-in and the project's custom SMTP in the Supabase
   dashboard — see [`supabase/README.md`](supabase/README.md). This is what makes
   student sign-up and emailed password-reset codes work.

### 2. API

```bash
cd backend
copy .env.example .env    # Windows (use cp on macOS/Linux)
npm install
npm run seed
npm run dev
```

The API runs at `http://localhost:3000`.

### 3. Web dashboard

```bash
cd frontend
npm install
npm run dev
```

The web app runs at `http://localhost:5173`.

**Sign in** with the superadmin or admin account configured in the seed script.
Run `npm run seed` to print the current accounts.

`backend/.env` decides where data lives via `DATA_MODE`:

- `DATA_MODE=supabase` — use Supabase (requires the migration above plus a real
  `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).
- `DATA_MODE=local` — use `backend/data/local-db.json`, no Supabase project needed.
- empty — auto-detect from the credentials.

Check the current state with `curl http://localhost:3000/api/health`; it reports
`mode` and a live `database` probe.

### 4. Mobile app

```bash
cd mobile
npm install
npx expo start
```

Install **Expo Go** and scan the terminal QR (Android) or use the Camera app
(iPhone).

| Role | School ID | Birthdate |
| --- | --- | --- |
| Student | `2023-0142` | `2003-04-12` |
| Organizer | `2024-0345` | `2004-06-30` |

Sign in with the school ID and birthdate, or press **Continue with Google**. New
accounts use one of the two sign-up buttons — **Sign up as student** or **Sign up as
organizer** — and stay pending until an admin approves them on the web dashboard's
*Approvals* page. The mobile app needs `DATA_MODE=supabase` because it uses real
rotating tokens.

#### Reaching the API from a phone

`localhost` on a phone points at the phone itself. Either:

- **Tunnel** — `cloudflared tunnel --url http://localhost:3000` (or
  `ngrok http 3000`) and paste the `https://…` URL into the **Server** field on the
  sign-in screen.
- **Same Wi-Fi** — use the computer's LAN address, e.g.
  `http://192.168.1.10:3000`, in the same **Server** field.

Tap **Save and test**; it shows `Connected · supabase mode · database ok`. The URL
is stored on the device. Copy `mobile/.env.example` to `mobile/.env` to bake in a
default instead, then restart Metro with `npx expo start --clear`. Quick-tunnel
URLs change on every restart, so prefer the in-app field.

See [`mobile/README.md`](mobile/README.md) for screens, QR payloads, and
troubleshooting.

### Root shortcuts

```bash
npm run dev:api      # start the Express API
npm run dev:web      # start the web dashboard
npm run dev:mobile   # start the Expo dev server
npm run build:web    # production build of the web app
npm run seed         # seed Supabase or the local dev database
```

## Documentation

- [`docs/PROJECT_ANALYSIS.md`](docs/PROJECT_ANALYSIS.md) — requirements extracted
  from the proposal and the proposed build plan.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — entities, ERD, data dictionary,
  role access matrix, and schema gaps.
- [`docs/FOLDER_STRUCTURE.md`](docs/FOLDER_STRUCTURE.md) — final folder layout and
  conventions.
- [`docs/CFD_DFD.md`](docs/CFD_DFD.md) — context flow diagram, leveled data flow
  diagrams, and the data dictionary.
- [`docs/COST_ESTIMATE.md`](docs/COST_ESTIMATE.md) — developmental and operating
  cost estimates in Philippine pesos.
- [`docs/Chapter_3_System_Design_and_Cost_Analysis.docx`](docs/Chapter_3_System_Design_and_Cost_Analysis.docx)
  — Chapter 3 as a Word document: CFD, DFD Level 1, per-actor DFDs, development
  cost, operating cost, and cost-benefit analysis. Upload to Drive and open with
  Google Docs to edit it online.
- [`docs/figures/`](docs/figures) — the six figures used in Chapter 3, exported as
  full-resolution PNG files.
- [`docs/erd-original.png`](docs/erd-original.png) — the ERD supplied with the
  proposal.

## Current status

| Area | Status |
| --- | --- |
| Supabase schema + RLS | Implemented, including `superadmin` (`0003`), the sign-up approval column (`0005`) and venue geofencing (`0006`) |
| Express API | Implemented (auth, onboarding, approval, tokens, scans, geofence, events, reports, health) and connected to Supabase |
| Web dashboard | Login, dashboard, students search, approvals queue, events, and Create Event (draggable venue pin on an OpenStreetMap + fence radius) use real API data; Reports and Settings still use demo data |
| Mobile app | Student and organizer flows run on the real API: student/organizer Google sign-up, approval wait, password reset by emailed code, rotating QR, self check-in with a location check, gatekeeper scan, events, history, profile |
| Local mode | `DATA_MODE=local` still works for API/web development with `backend/data/local-db.json` |
