# Frontend guide — web dashboard

React 19 + Vite 8, plain CSS, oxlint. The dashboard is for **superadmin** and
**admin** users only.

```bash
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run lint     # oxlint
npm run preview  # preview the production build
```

## Layout

| Folder | Responsibility |
| --- | --- |
| `src/app/App.jsx` | Shell: session, sidebar, topbar, page switching, logout |
| `src/components/ui/` | Reusable presentation with no feature knowledge |
| `src/features/<name>/` | One page plus feature-specific logic |
| `src/lib/api.js` | API client, session storage, error handling |
| `src/lib/demo-data.js` | Temporary demo data; remove a page's dependency when it goes live |
| `src/styles/app.css` | Dashboard styles |

## Rules

- A feature may import from `components/ui/` and `lib/`; features must not import
  each other.
- Shared components must not import feature pages.
- Put HTTP calls in `src/lib/api.js`, not in components. `VITE_API_URL` must
  include `/api` (see `.env.example`).
- When wiring a page to the API, handle loading, empty, and error states and
  delete its demo-data dependency immediately.
- Add new pages to the page map and navigation in `src/app/App.jsx`.
- Only the anon key may appear in Vite env files; never the service-role key.

## Design

`design-dna` (repo root `.agents/skills/design-dna`) is the design reference for
this dashboard and is **required** for UI work:

1. Load it with the `skill` tool before changing layout, colors, typography,
   spacing, icons, or components.
2. Take values from its `design_system` tokens and its `design_style` guidance.
   Keep shared values in `src/styles/app.css`; do not hard-code one-off hexes or
   pixel values in feature files.
3. When a reference screenshot or URL is involved, use the skill's Phase 2
   analysis flow and its measurement scripts instead of guessing colors.
4. Use only the parts of `visual_effects` that plain CSS can deliver.

## Verify

`npm run lint` and `npm run build`, then exercise the touched page against a
running API (`npm run dev:api` from the repo root).
