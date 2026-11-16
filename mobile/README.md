# LacoQR Mobile

The student and organizer app for **LacoQR**, the dynamic QR attendance system for
LCCB. It runs in **Expo Go** on Android and iPhone, and talks to the real Express
API in `../backend` — there is no mock data in this app.

| Role | Screens |
| --- | --- |
| **Student** | My QR (rotating personal code + gatekeeper access), Scan (self check-in), History, Profile |
| **Organizer** | Events, Event QR (rotating display code), Scan (gatekeeper), Profile |

## How data flows

```text
Phone (Expo Go) ──HTTP──> Express API :3000 ──> Supabase (Postgres + Auth)
```

Every screen reads and writes through `src/api/client.js`; no screen imports
fixture data. Attendance created from this app is real: it appears immediately in
the web dashboard, reports, and CSV export.

### QR payloads

| Code | Payload | Issued by | Scanned by |
| --- | --- | --- | --- |
| Student | `LQ-STU:<token>` | `POST /api/tokens/student` | Organizer **Scan** |
| Event | `LQ-EVT:<eventId>:<token>` | `POST /api/tokens/display` | Student **Scan** |

Tokens are stored and validated server-side and expire after 30 seconds
(`qr_window_seconds` per event for the event code). The projected event code
refreshes itself; the student's personal code is not refreshed automatically -
once it expires the screen asks them to tap **Generate again**. The scanners
reject expired codes, duplicate check-ins, students outside the event audience,
and events that are not live.

## Requirements

- Node.js 20+ and the backend running with `DATA_MODE=supabase`
- The **Expo Go** app on your phone
  - [Android – Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
  - [iOS – App Store](https://apps.apple.com/app/expo-go/id982107779)
- A URL the phone can reach for the API (see [Connecting a phone](#connecting-a-phone))

## Run it

```bash
# terminal 1
cd backend
npm run dev            # http://localhost:3000

# terminal 2
cd mobile
npm install
npx expo start
```

Then scan the terminal QR with Expo Go (Android) or the Camera app (iPhone).

### Sign in

Two ways in:

1. **School ID + birthdate** — the API derives the auth password from them
   (`digits(schoolId) + YYYYMMDD`), so no email is needed.
2. **Google** — tap *Continue with Google* and pick the Gmail account you signed up
   with.

| Role | School ID | Birthdate |
| --- | --- | --- |
| Student | `2023-0142` | `2003-04-12` |
| Organizer | `2024-0345` | `2004-06-30` |

Run `npm run seed` in `backend/` to print the full list.

There is also an **Email** tab for accounts that already have a password (that is
how you reach *Forgot password?*).

Staff accounts cannot use the app: if an admin or superadmin signs in (for example
by choosing their staff Gmail in *Continue with Google*), the app shows **Use the web
dashboard** with a *Log out* button instead of opening a tab group.

### Creating an account

Both students and organizers can self-register. The login screen has two sign-up
buttons, and the choice survives the Google redirect:

1. **Sign up as student** or **Sign up as organizer** → choose a Gmail account
   (*Continue with Google* on its own is the sign-in path for an existing account).
2. **Complete your profile** - full name, school ID (`2023-0142`, eight digits; the
   dash is inserted for you), birthdate (tap the field and pick from a calendar -
   only ages 10-100 are selectable), plus:
   - student: program (SBIT / ARFIEN / SSLATE / SHTM) and year level;
   - organizer: department (SBIT / ARFIEN / SSLATE / SHTM) only. The department is
     a profile field - the venue fence is set by the admin on each event.
   You can switch the role on the form if you pressed the wrong button.
3. **Waiting for approval** — the account exists but is inactive until an admin
   approves it on the web dashboard's *Approvals* page. *Check again* re-reads the
   status, so there is no need to sign out.
4. Once approved, the app opens on the student or organizer tabs.

Staff accounts still cannot self-register; the admin creates them.

### Profile photo (optional)

On the **Profile** tab, tap your avatar and pick **Take a photo** or **Choose from
library** (square crop, compressed). The image is uploaded to the public Supabase
`avatars` bucket and shown wherever your avatar appears - the profile header, the
student QR screen and the gatekeeper's verification sheet. **Remove photo**
returns to the initials avatar. Nothing breaks if you skip it.

### Forgot password

*Forgot password?* on the Email tab → enter the account email → the API asks
Supabase to mail a **6-digit code** → enter the code plus the new password. The
reset signs you in immediately.

The code arrives only if the Supabase project has custom SMTP configured and the
*Reset password* template prints `{{ .Token }}`; see
[`../supabase/README.md`](../supabase/README.md). The endpoint answers the same
way whether or not the email has an account.

## Connecting a phone

`localhost` on a phone points at the phone itself, so the app needs a reachable
API URL. Two options:

### 1. Tunnel (works anywhere)

Expose port 3000 with a Cloudflare quick tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

or ngrok:

```bash
ngrok http 3000
```

Copy the `https://…` URL, open the app, tap **Server** under the sign-in fields,
paste the URL, then **Save and test**. The screen shows `Connected · supabase mode
· database ok` when it works. The URL is stored on the device.

### 2. Same Wi-Fi (LAN IP)

Start the API and use the computer's LAN IPv4 address, e.g.
`http://192.168.1.10:3000`. Allow port 3000 through the firewall if Windows asks.
Point the in-app **Server** field at it — `http://` is added automatically and
`/api` is appended if missing.

### Bake the URL in with an env file

Copy `.env.example` to `.env`, set the values, then restart Metro:

```bash
EXPO_PUBLIC_API_URL=https://your-tunnel.trycloudflare.com
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
```

```bash
npx expo start --clear
```

`--clear` is required after changing `.env` because Metro caches public env vars.
The in-app Server setting still overrides `EXPO_PUBLIC_API_URL` per device.

The Supabase values power the Google button and use the **publishable (anon) key**,
never the service-role key. Without them the app hides Google and falls back to
school ID sign-in. The Google redirect URL `lacoqr://auth-callback` (and the
`exp://…/--/auth-callback` URL of your Metro session) must be allow-listed in
Supabase → Authentication → URL Configuration.

> **Quick tunnels get a new URL every restart.** If the app suddenly cannot reach
> the server, update the Server field (or `.env` + `--clear`).

## Screens

### Student

- **My QR** — requests a personal token when opened. It expires after 30
  seconds and the QR is replaced by a **Generate again** button, so nothing is
  refreshed behind the student's back. Brightness is raised while a code is
  showing and restored afterwards. Under the code, **Your gatekeeper access**
  lists any events where an admin granted this student the scanner, with the
  expiry and an **Open scanner** button, and each live event offers
  **Request to organize** (tap again to cancel a pending request).
- **Scan** — scans the organizer's event code and registers a self check-in.
  A location fix is requested on the same tap; the API checks the venue fence.
  Shows checked in / late / outside the venue / already checked in /
  check-in closed / error. When the fix is missing, mocked, or imprecise the
  check-in still succeeds and the sheet says it was saved unverified.
- **History** — real attendance records from `GET /api/reports/me`, with filters
  and pull-to-refresh.
- **Profile** — live stats (attended, on-time %, late) plus account details.

### Organizer

- **Events** — events assigned to the organizer, with live tally, audience size,
  and attendance progress.
- **Event QR** — rotating display code for a live event.
- **Scan** — gatekeeper mode: camera → student preview → confirm, with live
  counts refreshed after each check-in. Students with a temporary grant open the
  same screen from `/gatekeeper/[eventId]`; it then lists only granted events and
  hides **Change event**. The API rejects scanning your own QR at your own gate.
- **Profile** — assigned events, total scans, and turnout.

## Camera

The Scan tabs use `expo-camera` and need a physical device — simulators have no
camera. Grant camera access when prompted.

Only one scanner is mounted per role, so there is never more than one active
camera preview.

## Location

Student self check-in also uses `expo-location` (foreground only, installed with
`npx expo install expo-location`). The permission is requested when a code is
actually scanned, never on launch, and an 8-second cap keeps a slow GPS fix from
hanging the scanner.

- The app sends `latitude`, `longitude`, `accuracy` and `mocked` with the check-in.
- Denied permission, location switched off, a timeout, or a mocked fix are all
  non-fatal: the check-in is saved and flagged `location_unverified` server-side.
- Permission strings live in `app.json` under the `expo-location` plugin. Inside
  Expo Go you see Expo Go's own wording; the custom text applies to dev/prod builds.
- Organizer scanning never asks for location.

## Project structure

```text
mobile/
├── src/
│   ├── app/                     # Expo Router routes
│   │   ├── _layout.jsx          # fonts, providers, session bootstrap
│   │   ├── index.jsx            # sign in (Google / school ID / email) + server URL
│   │   ├── onboarding.jsx       # role-aware profile form for a new Google sign-up
│   │   ├── pending.jsx          # waiting-for-approval / disabled screen
│   │   ├── staff-only.jsx       # staff accounts are sent to the web dashboard
│   │   ├── forgot-password.jsx  # emailed 6-digit code → new password
│   │   ├── (student)/
│   │   │   ├── _layout.jsx
│   │   │   ├── qr.jsx
│   │   │   ├── scan.jsx
│   │   │   ├── history.jsx
│   │   │   └── profile.jsx
│   │   ├── gatekeeper/
│   │   │   └── [eventId].jsx     # student with a temporary grant → gatekeeper scanner
│   │   └── (organizer)/
│   │       ├── _layout.jsx
│   │       ├── events.jsx
│   │       ├── code.jsx
│   │       ├── scan.jsx
│   │       └── profile.jsx
│   ├── api/client.js            # HTTP boundary: session, tokens, scans, mappers
│   ├── components/              # shared UI (Button, Card, StatusBadge, …)
│   ├── context/AppContext.jsx   # boot, sign in/out, account status, server URL
│   ├── hooks/useQrToken.js      # API tokens + countdown (auto or manual rotation)
│   ├── lib/format.js            # dates, times, percentages
│   ├── lib/location.js          # foreground fix with timeout, for the fence
│   ├── lib/routes.js            # role → home route (student/organizer/staff)
│   ├── lib/storage.js           # SecureStore on native, localStorage on web
│   ├── lib/supabase.js          # PKCE client used only for the Google handshake
│   └── theme/tokens.js          # colors, spacing, typography
├── .env.example
├── app.json
└── package.json
```

## Design system

The palette and typography mirror the web dashboard:

| Token | Value |
| --- | --- |
| Navy | `#0f1c3f` |
| Brand blue | `#2563eb` |
| Present / live | `#10b981` |
| Late | `#f59e0b` |
| Absent | `#ef4444` |
| Background | `#f0f4f8` |
| Surface | `#ffffff` |
| Text / muted | `#0f172a` / `#64748b` |
| Font | Inter |

## Scripts

```bash
npm start          # start the Expo dev server
npm run android    # open on a connected Android device/emulator
npm run ios        # open on an iOS simulator (macOS only)
npm run web        # open the web build (camera is unavailable)
npm run lint       # eslint via expo lint
```

## Notes

- Sessions are stored with `expo-secure-store` on device and `localStorage` on
  web, so reopening the app keeps you signed in until the token expires or you
  log out.
- The API is the source of truth for who may scan what: organizers only see
  events they are assigned to, and students only see events for their program.
- Temporary gatekeeper access is event-scoped, so a student with a grant keeps
  every student screen. `GET /events?scope=organizing` drives the gatekeeper
  card and scanner; the grant disappears by itself an hour after the event, and
  the app falls back to the normal student view.
- The web build (`npm run web`) is handy for checking layout, but use a phone
  for camera testing.
