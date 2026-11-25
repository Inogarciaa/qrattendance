# LacoQR — repository guide

Dynamic QR attendance system for LCCB. Three apps live in one repo with no
workspace tooling: each folder has its own `package.json` and `node_modules`.

| Folder | Application | Stack |
| --- | --- | --- |
| `backend/` | REST API | Node 20+, Express 5, CommonJS, Supabase |
| `frontend/` | Admin / superadmin dashboard | React 19, Vite 8, plain CSS |
| `mobile/` | Student / organizer app | Expo SDK 58, Expo Router, React Native 0.88 |
| `supabase/` | Schema, RLS, seed SQL | Postgres |
| `docs/` | Analysis, data model, folder conventions | Markdown |

Read `README.md` for setup, `docs/DATA_MODEL.md` for the schema, and
`docs/FOLDER_STRUCTURE.md` for layer conventions.

## Commands (from the repo root)

```bash
npm run dev:api      # Express API on :3000
npm run dev:web      # Vite dashboard on :5173
npm run dev:mobile   # Expo dev server
npm run build:web    # production web build
npm run seed         # seed Supabase or the local dev database
```

Install dependencies per app: `npm install` inside `backend/`, `frontend/`, or
`mobile/`.

## Verification

- **Backend:** no automated tests. Start the API and call `GET /api/health`; it
  reports `mode` and a live `database` probe. Exercise the happy path plus one
  rejection path (missing token, wrong role, expired token).
- **Frontend:** `npm run lint` (oxlint) and `npm run build`.
- **Mobile:** `npx expo lint` and `npx tsc --noEmit`.

Run the checks for the app you touched before declaring work done.

## Data modes

`backend/.env` `DATA_MODE` selects `supabase` or `local`
(`backend/data/local-db.json`); empty auto-detects from the credentials.

- `local` covers the admin/web flows; `/api/scan` and `/api/tokens` require
  Supabase.
- The mobile app needs `DATA_MODE=supabase` because it relies on real rotating
  tokens.
- The **service-role key stays in `backend/.env`**. Only the anon key may appear
  in `frontend/` or `mobile/` env files.

## Rules

- The server is the source of truth for role, token validity, event liveness,
  attendance status, audience membership, and geofence checks. Never trust the
  client for these.
- Rotating QR tokens have a 30-second TTL; validate and consume them server-side.
- Do not edit an applied migration in `supabase/migrations/`; add the next
  numbered file (and keep `supabase/apply_all.sql` in sync if you use it).
- Follow each app's guide: `backend/AGENTS.md`, `frontend/AGENTS.md`,
  `mobile/AGENTS.md`.

## Skills

Project skills live in `.agents/skills/` and are discovered from any folder in
the repo. `design-dna` covers design tokens, style extraction from screenshots,
and visual effects — load it before redesigning UI. Global skills live in
`~/.agents/skills/` (for example `find-skills`).
