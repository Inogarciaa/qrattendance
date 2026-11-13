# LacoQR Mobile

Mobile UI prototype for **LacoQR**, the dynamic QR attendance system for LCCB.
It covers both roles — **Student** and **Organizer** — and runs in **Expo Go** on
Android and iPhone.

> This build uses **mock data only**. No API calls are made and no real
> attendance is recorded. The API boundary is stubbed in `src/api/client.js` so
> the screens can be wired to the Express backend later.

## Screens

### Student
| Screen | What it does |
| --- | --- |
| **My QR** | Rotating attendance QR with a 30-second countdown ring, auto-refresh, and screen-brightness boost |
| **Scan** | Camera scanner that simulates an event check-in and shows Present / Late / Duplicate results |
| **History** | Attendance records with filters, status pills, and pull-to-refresh |
| **Profile** | Student details, stats, settings, and logout |

### Organizer
| Screen | What it does |
| --- | --- |
| **Events** | Assigned events with live counts, capacity progress, and filters |
| **Scan** | Camera scanner → student verification sheet → confirm attendance |
| **Profile** | Organizer details, stats, settings, and logout |

## Requirements

- Node.js 20+ (LTS recommended)
- The **Expo Go** app on your phone
  - [Android – Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
  - [iOS – App Store](https://apps.apple.com/app/expo-go/id982107779)
- Phone and computer on the **same Wi-Fi network**

## Run it

```bash
cd mobile
npm install
npx expo start
```

Then:

- **Android** — open Expo Go and scan the QR code in the terminal.
- **iPhone** — open the Camera app, scan the QR code, and tap the Expo Go banner.

If the QR code cannot connect, use a tunnel:

```bash
npx expo start --tunnel
```

### Demo login

The login screen is prefilled with demo credentials. You can also skip straight
in with either role button:

- **Continue as Student** → Maria Santos (`2023-0142`)
- **Continue as Organizer** → Rafael Dizon (`2024-0345`)

## Camera

The Scan tabs use `expo-camera`. When prompted, allow camera access. If you
denied it earlier, re-enable it in the phone's app settings or reinstall Expo Go.

No real QR code is needed for the prototype — use the **Simulate scan** button
on either scanner to walk through the flow.

## Project structure

```text
mobile/
├── src/
│   ├── app/                     # Expo Router routes
│   │   ├── _layout.jsx          # fonts, providers, stack
│   │   ├── index.jsx            # login / role select
│   │   ├── (student)/
│   │   │   ├── _layout.jsx      # student tabs
│   │   │   ├── qr.jsx
│   │   │   ├── scan.jsx
│   │   │   ├── history.jsx
│   │   │   └── profile.jsx
│   │   └── (organizer)/
│   │       ├── _layout.jsx      # organizer tabs
│   │       ├── events.jsx
│   │       ├── scan.jsx
│   │       └── profile.jsx
│   ├── api/client.js            # mock API boundary → replace with fetch later
│   ├── components/              # shared UI (Button, Card, StatusBadge, …)
│   ├── context/AppContext.jsx   # demo session + live event counts
│   ├── hooks/useTokenRotation.js
│   ├── lib/format.js
│   ├── mock/data.js             # all mock users, events, and records
│   └── theme/tokens.js          # colors, spacing, typography, shadows
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
npm run lint       # eslint via expo lint
```

## Wiring the real API later

`src/api/client.js` contains one function per backend endpoint with the expected
request shape:

| Function | Endpoint |
| --- | --- |
| `login` | `POST /api/auth/login` |
| `issueStudentToken` | `POST /api/tokens/student` |
| `getEvents` | `GET /api/events` |
| `getAttendanceHistory` | `GET /api/reports/attendance/me` |
| `previewScan` | `POST /api/scan/preview` |
| `confirmScan` | `POST /api/scan/confirm` |

Replace each mock body with a `fetch` call and point `API_URL` at your Express
server (use the computer's LAN IP, e.g. `http://192.168.1.10:3000`, not
`localhost`, when testing on a physical phone).

## Notes

- Routes live in `src/app/`; Expo Router picks that directory up automatically.
- The prototype does not persist a session — reloading returns to login.
- Screen brightness is raised only while **My QR** is focused and restored on
  blur.
- QR tokens are generated locally and are not valid against the real backend.
