# Deploying LacoQR

Three parts deploy separately:

| Part | Folder | Host | Why |
| --- | --- | --- | --- |
| API | `backend/` | **Render** (Web Service) | Long-running Express process |
| Web dashboard | `frontend/` | **Vercel** | Static Vite build + CDN |
| Mobile app | `mobile/` | **Expo EAS** | Native binaries for phones |

Supabase stays where it is; both the API and the apps read `SUPABASE_*` values
from their host's environment settings. Nothing is hardcoded.

> Order matters: deploy the API first, because the web and mobile builds need its
> public URL (`https://<service>.onrender.com/api`).

---

## 1. API on Render

### 1.1 Create the service

1. Sign in at <https://dashboard.render.com> and connect your GitHub account.
2. **New + → Blueprint**, pick the `qrattendance` repository.
3. Render reads `render.yaml` and shows one service, `lacoqr-api`.
4. Fill in the prompted secrets (they are `sync: false`, so they are never in git):

   | Key | Value |
   | --- | --- |
   | `SUPABASE_URL` | `https://nmdawclfdvujqvxquvdr.supabase.co` |
   | `SUPABASE_ANON_KEY` | your anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service role secret key |
   | `SUPABASE_JWKS_URL` | `https://nmdawclfdvujqvxquvdr.supabase.co/auth/v1/.well-known/jwks.json` |
   | `CORS_ORIGIN` | leave blank for now, add the Vercel URL in step 3 |

   `AUTH_SECRET` is generated automatically. `DATA_MODE=supabase` is preset.

5. **Apply**. The first build takes a few minutes.

### 1.2 Confirm it is live

```text
https://lacoqr-api.onrender.com/          -> {"status":"ok", ...}
https://lacoqr-api.onrender.com/api/health -> {"status":"ok","database":"ok"}
```

If `database` says `schema-missing-or-unreachable`, the Supabase keys are wrong
or migration `0011_archive_and_roles.sql` was never applied to that project.

### Free-tier behaviour

Render's free plan sleeps after ~15 minutes of inactivity. The next request takes
20–50 seconds to wake. Open the health URL before a demo, or upgrade the plan.

---

## 2. Supabase settings for Google sign-in

In **Supabase → Authentication → URL Configuration**:

- **Site URL**: `https://<your-dashboard>.vercel.app`
- **Redirect URLs** (add all of these):

  ```text
  https://<your-dashboard>.vercel.app/**
  lacoqr://auth-callback
  exp://**            (only while testing in Expo Go)
  http://localhost:8081/**
  ```

`lacoqr://auth-callback` comes from `Linking.createURL("auth-callback")` with the
`scheme` in `mobile/app.json`. Without it the mobile Google handshake fails with
"Google sign-in was cancelled".

---

## 3. Web dashboard on Vercel

1. <https://vercel.com/new> → import the same repository.
2. **Root Directory**: `frontend` (important — the repo root is not an app).
3. Framework preset: **Vite**. Build `npm run build`, output `dist`
   (already declared in `frontend/vercel.json`).
4. **Environment Variables**:

   | Key | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://lacoqr-api.onrender.com/api` |

5. **Deploy**, then copy the production domain (e.g.
   `https://qrattendance.vercel.app`).
6. Go back to Render → `lacoqr-api` → **Environment** → set

   ```text
   CORS_ORIGIN=https://qrattendance.vercel.app,https://*.vercel.app
   ```

   The wildcard covers Vercel preview deployments. Save; Render redeploys.

Sign in with the superadmin account to confirm the dashboard can reach the API.

---

## 4. Mobile app with EAS

### 4.1 One-time setup

```bash
cd mobile
npx eas-cli@latest login          # Expo account (owner: tsmvipe)
npx eas-cli@latest init           # writes extra.eas.projectId into app.json
```

`mobile/eas.json` already defines the three profiles and the production API URL.
If your Render URL differs from `lacoqr-api.onrender.com`, update the
`EXPO_PUBLIC_API_URL` values in that file.

### 4.2 Build

```bash
# Installable APK for testers (no Play Store needed)
npx eas-cli@latest build --platform android --profile preview

# Store-ready build
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

EAS prints a download link when the build finishes. Install the APK, sign in as
a student and as an organizer, and try a scan on the deployed API.

### 4.3 Ship updates without rebuilding

```bash
npx eas-cli@latest update --branch production --message "Fix scanner copy"
```

Only JavaScript changes can go this way; new native modules need a new build.

---

## 5. Post-deploy smoke test

Run these against the live API (replace the token after signing in):

```bash
curl https://lacoqr-api.onrender.com/api/health

curl -X POST https://lacoqr-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"..."}'

curl https://lacoqr-api.onrender.com/api/reports/export \
  -H "Authorization: Bearer <token>" -o report.csv
```

Then in the dashboard:

1. Sign in as superadmin → **Dashboard** loads the next event.
2. **Reports → Export CSV** downloads a file with real rows.
3. **Activity** shows archive/restore/staff/gatekeeper history.
4. **Settings → Staff accounts** creates an admin.

And on a phone:

1. Student login with school ID + birthdate.
2. Rotating QR appears and refreshes every 30 seconds.
3. Organizer scans it; the attendance row appears in the dashboard live view.

---

## 6. Secrets and cost

- Never commit `.env`. Render and Vercel hold the values; the repo holds only
  `.env.example` files.
- Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase → Project Settings → API if it
  is ever pasted into a chat, a screenshot, or a commit.
- Free tiers: Render (1 sleeping web service), Vercel (hobby), Expo EAS (limited
  monthly build minutes), Supabase (500 MB database). All four cover a thesis
  demo; watch the EAS build quota during busy weeks.
