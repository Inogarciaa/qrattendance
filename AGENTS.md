# Scanly — repository guide

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
- **Design changes go through `design-dna`.** Before changing UI, layout,
  styling, colors, typography, spacing, icons, or shared components, load the
  `design-dna` skill and work from its three dimensions (`design_system`,
  `design_style`, `visual_effects`). Do not introduce ad-hoc colors, spacing, or
  type scales.

## Skills

Project skills live in `.agents/skills/` and are discovered from any folder in
the repo. `design-dna` is this repo's design reference and is required for any
UI or design work — load it with the `skill` tool before touching screens,
tokens, or styles. Global skills live in `~/.agents/skills/` (for example
`find-skills`).

This is enforced by `.opencode/plugins/design-guard`: it blocks `edit` and
`write` on UI paths until `design-dna` is loaded in the current session. Gated
paths:

- `frontend/index.html`, `frontend/src/app/`, `frontend/src/components/`,
  `frontend/src/features/`, `frontend/src/styles/`, `frontend/src/index.css`
- `mobile/app.json`, `mobile/assets/`, `mobile/src/app/`,
  `mobile/src/components/`, `mobile/src/theme/`

Logic files such as `frontend/src/lib/`, `mobile/src/api/`, `mobile/src/lib/`,
and all of `backend/` stay editable without the skill.
