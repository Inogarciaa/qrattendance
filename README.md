# LacoQR — Dynamic QR Attendance System

A real-time event attendance platform based on the thesis proposal
**"Real-Time Event Attendance Management System Using Dual Dynamic QR Codes with
Human-in-the-Loop Visual Verification."**

The system uses rotating QR codes (30-second lifetime), two scanning modes
(gatekeeper and self-service), and an organizer verification step before an
attendance record is saved.

## Applications

| Folder | Application | Primary users |
| --- | --- | --- |
| `backend/` | Express REST API over Supabase | All clients |
| `frontend/` | React + Vite web dashboard | Superadmin, Admin |
| `mobile/` | Expo / React Native app (planned) | Student, Organizer |
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
   - `supabase/seed.sql`

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

If `SUPABASE_URL` still contains the placeholder `your-project`, the API runs in
**local development mode**: accounts, programs, and events are stored in
`backend/data/local-db.json`, so no Supabase project is required. Run
`npm run seed` to print the accounts again. With real Supabase credentials, apply
the migrations (including `0003_superadmin.sql`) first.

### Root shortcuts

```bash
npm run dev:api      # start the Express API
npm run dev:web      # start the web dashboard
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
| Supabase schema + RLS | Implemented, with `superadmin` added in `0003_superadmin.sql` |
| Express API | Implemented (auth, tokens, scans, events, reports) |
| Web dashboard | Role-based login and Create Event are live; dashboard/reports/students still use demo data |
| Mobile app | Prototype with mock data; real API wiring pending |
