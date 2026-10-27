# Folder Structure and Conventions

The goal is a layout that a beginner can open and understand without learning a
heavy monorepo tool. That is why the project keeps the familiar top-level
`backend/` and `frontend/` folders, then adds `mobile/` for the Expo app.

We deliberately **do not** use `apps/`, `packages/`, Turborepo, Nx, or npm
workspaces yet. Those are useful for large teams, but they add configuration and
indirection that slow down a thesis-sized project. The simple layout can be
migrated later if the project grows.

---

## 1. Final structure

```text
dynamicqr/
├── backend/                        # Express REST API
│   ├── scripts/
│   │   └── seed.js                 # creates demo accounts and an event
│   ├── src/
│   │   ├── lib/
│   │   │   ├── password.js         # school-ID login helpers
│   │   │   └── supabase.js         # Supabase clients (anon + service role)
│   │   ├── middleware/
│   │   │   └── auth.js             # bearer auth + role guard
│   │   ├── routes/
│   │   │   ├── admin.js            # imports, student search
│   │   │   ├── auth.js             # login, refresh, me
│   │   │   ├── dashboard.js        # live dashboard data
│   │   │   ├── events.js           # event CRUD, organizers, audiences, close
│   │   │   ├── programs.js         # program list
│   │   │   ├── reports.js          # filtered records + CSV export
│   │   │   ├── scan.js             # preview, confirm, self check-in
│   │   │   └── tokens.js           # student/display token issue
│   │   ├── services/
│   │   │   ├── attendance.js       # event time, status, audience, logs
│   │   │   └── tokens.js           # issue/validate/consume tokens
│   │   └── index.js                # Express app bootstrap
│   ├── .env.example
│   ├── package.json
│   └── README.md
│
├── frontend/                       # React web dashboard (superadmin/admin)
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── app/
│   │   │   └── App.jsx             # shell: sidebar, topbar, page switch, logout
│   │   ├── components/
│   │   │   └── ui/
│   │   │       ├── DataTable.jsx
│   │   │       ├── Field.jsx
│   │   │       ├── Icon.jsx
│   │   │       ├── PageHeader.jsx
│   │   │       └── StatusBadge.jsx
│   │   ├── features/
│   │   │   ├── dashboard/
│   │   │   │   └── DashboardPage.jsx
│   │   │   ├── events/
│   │   │   │   └── CreateEventPage.jsx
│   │   │   ├── help/
│   │   │   │   └── HelpPage.jsx
│   │   │   ├── reports/
│   │   │   │   └── ReportsPage.jsx
│   │   │   ├── settings/
│   │   │   │   └── SettingsPage.jsx
│   │   │   └── students/
│   │   │       └── SearchStudentsPage.jsx
│   │   ├── lib/
│   │   │   ├── demo-data.js        # temporary data; delete as pages go live
│   │   │   └── format.js           # time/name formatting helpers
│   │   ├── styles/
│   │   │   └── app.css             # dashboard styling
│   │   ├── index.css               # minimal global reset
│   │   └── main.jsx                # React entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── mobile/                         # Expo / React Native app (next phase; README only for now)
│   ├── app/                        # Expo Router routes
│   │   ├── _layout.jsx
│   │   ├── index.jsx               # login / role redirect
│   │   ├── (student)/
│   │   │   ├── qr.jsx              # personal rotating QR
│   │   │   ├── scan.jsx            # self-service scanner
│   │   │   └── history.jsx
│   │   └── (organizer)/
│   │       ├── events.jsx          # assigned events
│   │       ├── scanner.jsx         # gatekeeper camera
│   │       └── verify.jsx          # verification sheet
│   ├── src/
│   │   ├── api/                    # API client + auth storage
│   │   ├── components/             # shared mobile UI
│   │   ├── hooks/                  # useAuth, useTokenRotation, etc.
│   │   ├── lib/                    # constants, formatting, validation
│   │   └── theme/                  # colors, spacing, typography
│   ├── app.json
│   ├── package.json
│   └── README.md
│
├── supabase/                       # database source of truth
│   ├── migrations/
│   │   ├── 0001_schema.sql
│   │   └── 0002_rls.sql
│   ├── seed.sql
│   └── README.md
│
├── docs/
│   ├── PROJECT_ANALYSIS.md
│   ├── DATA_MODEL.md
│   ├── FOLDER_STRUCTURE.md
│   └── erd-original.png
│
├── .gitignore
├── package.json                    # root convenience scripts only
└── README.md
```

---

## 2. Backend layers

The backend uses a small, explicit layered pattern:

| Folder | Responsibility | Example |
| --- | --- | --- |
| `routes/` | Define endpoints and call services. | `POST /api/scan/confirm` |
| `services/` | Business rules that are reused by routes. | token validation, late computation |
| `middleware/` | Cross-cutting request checks. | `requireAuth`, `requireRole` |
| `lib/` | Infrastructure and small helpers. | Supabase client, password derivation |
| `scripts/` | One-off developer commands. | seeding |

We intentionally avoid a separate `controllers/` folder for now. The route files
are small enough that an extra layer would only add jumping between files. If a
route grows beyond roughly 250 lines, split its request handling into a
`controllers/` file and keep the route file as a thin mapping.

### Backend rules

- Validate all input at the route boundary.
- Never trust the client for role, token validity, event liveness, or status.
- Business rules belong in `services/`, not in React or Expo code.
- Only `lib/supabase.js` creates Supabase clients.
- The service-role key is server-side only and must never appear in a Vite or
  Expo environment file.
- Every new endpoint gets a row in `backend/README.md`.

### Adding a backend feature

1. Add/extend a route in `src/routes/<feature>.js`.
2. Put reusable logic in `src/services/`.
3. Reuse `requireAuth` / `requireRole` from `src/middleware/auth.js`.
4. Add the route to `src/index.js` if it is a new prefix.
5. Document it in `backend/README.md`.
6. Test the happy path plus at least one rejection path.

---

## 3. Frontend layers

The current web app is a single-page dashboard. It is organized by **feature**,
not by file type, so everything needed to change a screen is in one folder.

| Folder | Responsibility |
| --- | --- |
| `app/` | Application shell: sidebar, topbar, page switching, logout. |
| `components/ui/` | Reusable presentation components with no feature knowledge. |
| `features/<name>/` | One page and its feature-specific logic. |
| `lib/` | Formatting helpers and temporary demo data. |
| `styles/` | Global dashboard styles. |

### Frontend rules

- A feature page may import from `components/ui/` and `lib/`.
- A feature page must not import another feature page.
- Shared components must not import feature pages.
- Keep API calls in a dedicated client once the real integration starts
  (recommended: `src/lib/api.js`).
- Keep demo data only in `lib/demo-data.js`; do not scatter sample arrays inside
  pages.
- When a page is wired to the API, remove its demo data dependency immediately.

### Adding a frontend feature

1. Create `src/features/<feature>/<Name>Page.jsx`.
2. Add the page to the page map and navigation in `src/app/App.jsx`.
3. Put reusable controls in `src/components/ui/`.
4. Add styles to `src/styles/app.css`.
5. If the page needs data, add a function to `src/lib/api.js` (when created) and
   handle loading, empty, and error states.

---

## 4. Mobile layers

The mobile app is not implemented yet. The planned structure uses **Expo Router**
because file-based routes are easy to follow:

- `(student)` group contains student-only screens.
- `(organizer)` group contains organizer-only screens.
- `src/api/` owns HTTP calls and secure session storage.
- `src/hooks/useTokenRotation.js` handles the 30-second QR refresh lifecycle.
- `src/hooks/useAuth.js` exposes the current profile and role.

The role-based redirect lives in `app/index.jsx`: after login, students go to
`(student)/qr`, organizers go to `(organizer)/events`, and admins are told to use
the web dashboard (or are signed out of the mobile app).

---

## 5. Supabase

`supabase/migrations/` is the database source of truth.

- Apply migrations in numeric order.
- Never edit an applied migration in a shared environment; add the next numbered
  migration.
- RLS policies belong in the migration that creates or changes the table.
- `seed.sql` holds static reference data (programs). The Node seed script creates
  Auth users because plain SQL cannot create Supabase Auth accounts safely.

Suggested next migration:

```text
supabase/migrations/0003_alignment.sql
```

It should contain the priority-0 changes from `docs/DATA_MODEL.md`:
`superadmin`, token hashing, and year-level audiences.

---

## 6. Naming conventions

| Item | Convention | Example |
| --- | --- | --- |
| Folders | lowercase, plural for collections | `features/events/` |
| React components | PascalCase file and export | `CreateEventPage.jsx` |
| Hooks | `use` prefix | `useTokenRotation.js` |
| Backend route files | lowercase feature name | `scan.js` |
| Service functions | verb + noun | `issueToken`, `validateToken` |
| Database tables | lowercase plural | `event_organizers` |
| Database columns | snake_case | `event_date`, `school_id` |
| Env variables | UPPER_SNAKE_CASE | `SUPABASE_URL` |
| API paths | lowercase, plural resources | `/api/events/:id/close` |

---

## 7. Environment files

| File | Used by | Contains |
| --- | --- | --- |
| `backend/.env` | Express API | Supabase URL, anon key, service-role key, port, auth email domain |
| `frontend/.env` | Vite web app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` |
| `mobile/.env` | Expo app | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` |

Only the **anon** key may be used by the web/mobile clients. The
**service-role** key stays in `backend/.env`.

---

## 8. What changed from the original layout

| Before | After | Why |
| --- | --- | --- |
| Empty `backend/controller/`, `controllers/`, `models/`, `routes/` folders | Removed | They were unused duplicates of `backend/src/`. |
| One 42 KB `frontend/src/App.jsx` containing CSS, icons, demo data, and all pages | Split into `app/`, `components/ui/`, `features/`, `lib/`, `styles/` | Easier to find and change one screen. |
| Duplicate `frontend/src/assets/App.jsx` and template assets | Removed | No file imported them; they were an older prototype. |
| Vite template CSS with large global heading rules | Minimal reset in `index.css` | Prevents the template styles from fighting the dashboard. |
| No root documentation | `README.md` + `docs/` | New contributors can understand the project before coding. |
| No mobile folder | `mobile/` documented with planned structure | The next phase has a clear home. |

---

## 9. Golden rule

> If you are unsure where a file belongs, ask: **is it a page, a reusable UI
> piece, a business rule, or infrastructure?** Put it in `features/`,
> `components/ui/`, `services/`, or `lib/` respectively.
