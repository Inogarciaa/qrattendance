# Mobile App (Planned)

This folder is reserved for the **Expo / React Native** app used by students and
event organizers. It is not implemented yet.

## Why Expo

- One codebase runs on Android and iOS.
- `expo-camera` provides QR scanning without native build setup.
- `expo-secure-store` keeps the access/refresh token out of plain storage.
- Expo Router gives beginner-friendly file-based navigation.
- A physical phone can test the app during the thesis demo with Expo Go.

## Planned stack

| Need | Package |
| --- | --- |
| Runtime / tooling | Expo |
| Navigation | Expo Router |
| QR scanning | `expo-camera` |
| QR display | `react-native-qrcode-svg` |
| Secure session storage | `expo-secure-store` |
| API calls | `fetch` through `src/api/client.js` |
| Optional direct realtime | `@supabase/supabase-js` with the anon key |

The mobile app should call the **Express API** for login, token issue, and
attendance. Do not put the Supabase service-role key in the app.

## Planned routes

```text
mobile/
├── app/
│   ├── _layout.jsx             # auth provider + stack
│   ├── index.jsx               # login screen / role redirect
│   ├── (student)/
│   │   ├── qr.jsx              # personal rotating QR
│   │   ├── scan.jsx            # self-service event scanner
│   │   └── history.jsx         # personal attendance history
│   └── (organizer)/
│       ├── events.jsx          # assigned events
│       ├── scanner.jsx         # gatekeeper camera
│       └── verify.jsx          # photo + identity verification sheet
├── src/
│   ├── api/
│   │   ├── client.js           # base URL, auth header, error handling
│   │   └── endpoints.js        # login, tokens, scan, events
│   ├── components/
│   ├── hooks/
│   │   ├── useAuth.js
│   │   └── useTokenRotation.js
│   ├── lib/
│   │   └── constants.js
│   └── theme/
│       └── tokens.js
├── app.json
├── package.json
└── README.md
```

## Role flows

### Student

1. Log in with school ID and birthdate.
2. Land on the **My QR** tab.
3. Request `POST /api/tokens/student`; display the token as a QR.
4. Refresh the token before the 30-second expiry (recommended every 25 seconds).
5. Use the scanner tab to scan an event display QR and call
   `POST /api/scan/self-checkin`.
6. Show success, duplicate, expired, or not-in-audience messages.
7. View personal attendance history.

### Organizer

1. Log in and land on **My Events** (`GET /api/events` is scoped by role).
2. Open an assigned event and start the gatekeeper scanner.
3. Scan a student QR and call `POST /api/scan/preview`.
4. Pause the camera and show the verification card: photo, name, school ID,
   program, year level, predicted status, and duplicate warning.
5. **Confirm** → `POST /api/scan/confirm`.
6. **Cancel** → close the card and resume scanning.
7. Show live present/late/absent counts for the event.

## Token rotation hook

`useTokenRotation` should:

- request a token when the screen mounts;
- schedule a refresh a few seconds before `expires_at`;
- cancel timers when the screen unmounts or the app goes to the background;
- re-request immediately when the app returns to the foreground;
- handle network failures by showing a retry state, never by reusing an expired
  token.

## Security notes

- Store the session with `expo-secure-store`, not `AsyncStorage`.
- Never trust the device clock for token validity; the server checks expiry.
- Do not cache a screenshot-friendly QR; the code should visibly refresh.
- Treat student photos as private and load them only after the API has authorized
  the organizer for that event.
- Log out clears the secure session and any cached student data.

## Next step

When the mobile phase starts:

```bash
cd mobile
npx create-expo-app@latest . --template tabs
npx expo install expo-camera expo-secure-store react-native-qrcode-svg
```

Then replace the generated screens with the routes above and point
`src/api/client.js` at `http://<your-lan-ip>:3000/api`. A physical phone cannot
reach `localhost` on the development machine; use the machine's LAN IP.
