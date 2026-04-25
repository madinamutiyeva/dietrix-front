# DIETRIX — Frontend client

React 18 + TypeScript + Vite SPA for the DIETRIX backend.

## Quick start

```bash
cd client
npm install
npm run dev        # http://localhost:3000
npm run build      # production bundle to dist/
npm run preview    # serve the built bundle
```

The dev server proxies `/api/*` to `http://localhost:8080` — make sure the
backend is running there (configurable in `vite.config.ts`).

## Routes

| Route | Component | Auth |
|-------|-----------|------|
| `/sign-in` | `pages/SignIn.tsx` | public |
| `/sign-up` | `pages/SignUp.tsx` | public |
| `/forgot-password` | `pages/ForgotPassword.tsx` | public |
| `/onboarding` | `pages/Onboarding.tsx` | required |
| `/home` | `pages/Home.tsx` | required |
| `/my-plan` | `pages/MyPlan.tsx` | required |
| `/pantry` | `pages/Pantry.tsx` | required |
| `/ai-generate` | `pages/AiGenerate.tsx` | required |
| `/chat` | `pages/Chat.tsx` | required |
| `/settings` | `pages/Settings.tsx` | required |
| `/profile` | `pages/Profile.tsx` | required |

## Project layout

```
client/
├── index.html               # viewport, theme-color, FontAwesome, Inter
├── vite.config.ts           # dev server + /api proxy (SSE-aware)
└── src/
    ├── main.tsx             # entrypoint, imports global stylesheets
    ├── App.tsx              # routes + ErrorBoundary + NotificationsProvider
    ├── api/
    │   ├── client.ts        # Axios instances, JWT helpers, all endpoint fns
    │   └── contracts.ts     # every request/response DTO (single source of truth)
    ├── components/
    │   └── NotificationBell.tsx
    ├── lib/
    │   ├── notifications.tsx  # NotificationsProvider + useNotifications()
    │   └── sse.ts             # EventSource connection
    ├── pages/                 # one file per route
    └── styles/                # one stylesheet per page + responsive.css
```

## Authentication

Tokens are stored in `localStorage` under `dietrix_access_token` /
`dietrix_refresh_token`. `api/client.ts` wires up:

- a request interceptor that **proactively** refreshes the access token if
  it expires within 30 s;
- a response interceptor that retries on `401` with a fresh token;
- a 30-second background watchdog that refreshes ~1 minute before expiry,
  surviving long idle tabs.

On any unrecoverable refresh failure the user is redirected to `/sign-in`.

Helpers exported from `api/client.ts`:
`getAccessToken`, `getRefreshToken`, `saveTokens`, `clearTokens`.

## Realtime notifications (SSE)

Live notifications are delivered over Server-Sent Events from
`GET /api/notifications/stream?token=<accessToken>` — the token is passed in
the query string because the browser `EventSource` cannot set headers; the
backend allows `?token=` **only** for this path.

- `lib/sse.ts` opens the `EventSource` and listens for `connected` /
  `notification` events, with native browser auto-reconnect (~3 s).
- `lib/notifications.tsx` is a React context provider that:
  - fetches the initial unread count + recent items via `GET /api/notifications`
    on mount and on every token change (so login → SSE connects);
  - re-opens the stream whenever the access token appears or rotates and
    closes it on logout;
  - exposes `useNotifications()` → `{ items, unreadCount, markAllRead, push }`;
  - renders toasts top-right (auto-dismiss 5 s, click to close);
  - silently drops empty / heartbeat events so no phantom toasts appear.
- `components/NotificationBell.tsx` is the bell icon used in every page
  navbar; click clears the local unread counter.

The provider is mounted once at the app root in `App.tsx` and outlives all
route changes.

## API contracts

All request/response TypeScript interfaces live in `src/api/contracts.ts`.
Every endpoint has a JSDoc comment with HTTP method, path, and auth
requirement. When the backend changes a payload, update this file first.

More detail in `docs/API_CONTRACTS.md`. SSE-specific notes in
`docs/SSE_NOTIFICATIONS_QUICKSTART.md`.

## Styling & responsiveness

Each page has a sibling stylesheet under `src/styles/`. A shared
`responsive.css` is imported **last** in `main.tsx` and contains all
mobile / iPhone overrides:

- safe-area insets (`env(safe-area-inset-*)`) for notch & home indicator;
- 16 px minimum input font-size to prevent iOS auto-zoom on focus;
- 44 × 44 minimum tap targets (Apple HIG);
- navbar collapses on `≤480 px`, logo-only on `≤375 px`;
- modals turn into bottom-sheets on phones;
- toasts span the screen width with safe-area top padding.

Breakpoints in use: `≤992 px`, `≤768 px`, `≤480 px`, `≤375 px`.

## Environment variables

All env vars must be prefixed with `VITE_` to be exposed to the bundle.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | prod only | _(empty → relative `/api` via Vite proxy)_ | Absolute backend origin, e.g. `https://api.dietrix.app`. |

Files:

- `.env.example` — committed template, shows what you need to set.
- `.env.local` — git-ignored, your local overrides.
- `.env.production` — pass at build time on the deploy host (Vercel/Netlify/etc.) via UI or CI.

Locally you do **not** need to set `VITE_API_URL` — `npm run dev` proxies
`/api/*` to `http://localhost:8080` (see `vite.config.ts`). The same proxy
config also keeps SSE working without buffering.

Production build picks up the value at **bundle time**:

```bash
VITE_API_URL=https://api.dietrix.app npm run build
```

## Deploying

1. `npm run build` → static bundle in `client/dist/`.
2. Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, S3 + CloudFront…).
3. Make sure your static host serves `index.html` for unknown routes (SPA fallback) — otherwise React Router 404s on refresh.
4. Set `VITE_API_URL` in the host's environment-variable UI **before** triggering the build.
5. CORS: the backend must allow your frontend origin. SSE additionally needs the backend to send proper `Cache-Control: no-cache` and to leave the connection open through any reverse proxies (`X-Accel-Buffering: no` for nginx).

## Tech stack

| Layer | Library |
|-------|---------|
| UI framework | React 18 |
| Language | TypeScript 5 |
| Build tool | Vite 5 |
| Routing | React Router 6 |
| Forms | React Hook Form 7 |
| HTTP client | Axios |
| Realtime | Native `EventSource` (SSE) |
| Icons | Font Awesome 6 (CDN) |
| Fonts | Inter via Google Fonts |

## Conventions

- **No global state library.** React state + context (`NotificationsProvider`)
  is enough. Auth is implicit via tokens in `localStorage`.
- **Strict TypeScript** — no implicit `any` in app code; backend payloads are
  always typed against `contracts.ts`.
- **One DTO file** — `contracts.ts` is the only place where API shapes are
  declared. Pages import types from there.
- **Pages own their styling** — page-specific classes live in the matching
  `src/styles/<page>.css`. Cross-cutting concerns (mobile, layout resets)
  go into `responsive.css`.

