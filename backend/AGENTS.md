# Backend guide — Express API

CommonJS, Express 5, Node 20+. `src/index.js` boots the app and mounts every
route. `npm run dev` runs it with `node --watch-path=src`.

## Layout

| Folder | Responsibility |
| --- | --- |
| `src/routes/` | Endpoint definitions, mounted in `src/index.js` |
| `src/services/` | Reusable business rules (tokens, attendance) |
| `src/middleware/` | `requireAccount`, `requireAuth`, `requireRole` |
| `src/lib/` | Supabase clients, local DB, auth tokens, geo, schema helpers |
| `scripts/` | One-off commands (`seed.js`, `check-geo.js`) |

Route files hold request handling until they pass roughly 250 lines; then split
the logic into a `controllers/` file and keep the route as a thin mapping.

## Rules

- Validate input at the route boundary. Never trust the client for role, token
  validity, event liveness, attendance status, or geofence results.
- Business rules belong in `src/services/`, not in routes or client apps.
- Only `src/lib/supabase.js` creates Supabase clients. Writes use the
  service-role client; access control uses `requireAuth` / `requireRole`.
- `superadmin` passes every `admin` guard — do not duplicate that check.
- Every new endpoint gets a row in `backend/README.md`.
- New environment variables go in `backend/.env.example` with a comment.
- `/api/scan` and `/api/tokens` are Supabase-only. When changing code that
  branches on `isLocalMode`, keep `DATA_MODE=local` working for the admin/web
  flows.

## Verify

No automated test suite. Start the API and check `GET /api/health`, then test the
happy path plus at least one rejection (missing token, wrong role, expired or
already-consumed token). For anything touching attendance, confirm the record
appears in `/api/reports` and the dashboard.
