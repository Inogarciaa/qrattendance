# AttendX Web Dashboard

React + Vite dashboard for **superadmin** and **admin** users.

The current version is a UI prototype. It uses demo data from
`src/lib/demo-data.js`; the next phase is to replace each page's data source with
the Express API.

## Run

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

```bash
npm run build     # production build in dist/
npm run lint      # oxlint
npm run preview   # preview the production build
```

## Structure

```text
src/
├── app/
│   └── App.jsx                 # sidebar, topbar, page switching, logout
├── components/
│   └── ui/                     # reusable presentation components
│       ├── DataTable.jsx
│       ├── Field.jsx
│       ├── Icon.jsx
│       ├── PageHeader.jsx
│       └── StatusBadge.jsx
├── features/
│   ├── dashboard/DashboardPage.jsx
│   ├── events/CreateEventPage.jsx
│   ├── help/HelpPage.jsx
│   ├── reports/ReportsPage.jsx
│   ├── settings/SettingsPage.jsx
│   └── students/SearchStudentsPage.jsx
├── lib/
│   ├── demo-data.js            # temporary; remove as pages go live
│   └── format.js
├── styles/app.css
├── index.css                   # minimal reset
└── main.jsx
```

## Where to add a page

1. Create `src/features/<feature>/<Name>Page.jsx`.
2. Import it in `src/app/App.jsx`.
3. Add a navigation entry to `MAIN_NAV` or `GENERAL_NAV`.
4. Reuse `PageHeader`, `Field`, `DataTable`, and `StatusBadge`.
5. Add styles to `src/styles/app.css`.

## Connecting the API

When wiring a page to the backend:

1. Add an API client (recommended: `src/lib/api.js`) that reads
   `import.meta.env.VITE_API_URL` and attaches the bearer token.
2. Replace the demo-data import with a request.
3. Add loading, empty, and error states.
4. Remove that page's demo data from `src/lib/demo-data.js`.

Suggested `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

Never put the Supabase service-role key in a Vite environment variable. Only the
anon key is safe for client-side use.

## Planned admin screens

- Login and role guard (admin vs. superadmin).
- Event list and event detail/edit.
- Organizer and audience assignment.
- Full-screen display terminal with a 30-second rotating QR.
- Live dashboard using realtime updates.
- Student search connected to `/api/admin/students`.
- Reports and CSV export connected to `/api/reports`.
- Superadmin: admin management, programs, settings, audit logs.
