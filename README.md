# DIETRIX

Web application for personalised nutrition: meal plans, pantry tracking,
AI-powered recipe generation, an in-app nutrition chat and live notifications.

This repository hosts the **frontend** only (React + Vite). The Spring Boot
backend lives in a separate repo.

```
Dietrix_front/
├── client/             # React 18 + TypeScript + Vite app (the actual app)
│   ├── src/
│   ├── docs/           # API contracts, SSE quick-start
│   └── README.md       # detailed dev / deploy guide
├── package.json        # convenience shortcuts that proxy into client/
└── README.md           # ← you are here
```

## Quick start

```bash
# 1. Install
npm run install:client

# 2. Run dev server (http://localhost:3000)
npm run dev

# 3. Production bundle (client/dist/)
npm run build
```

The dev server proxies `/api/*` to `http://localhost:8080`, so make sure
the Dietrix backend is running there. Override with `VITE_API_URL` for
remote backends — see `client/README.md`.

## Features

- 📋 **Meal plans** — daily / weekly nutrition plans with macros & shopping list
- 🤖 **AI recipe generator** — produce recipes from pantry items
- 🥫 **Pantry** — track what you have at home, expiry alerts
- 💬 **Nutrition chat** — Q&A with built-in FAQ and topic articles
- 🔔 **Realtime notifications** — Server-Sent Events, no Firebase required
- 📱 **Mobile-first** — full iPhone / safe-area / 44 px tap targets support
- 🔐 **JWT auth** — proactive token refresh, idle-tab survival

## Tech stack

| Layer | Library |
|-------|---------|
| UI | React 18, TypeScript 5 |
| Build | Vite 5 |
| Routing | React Router 6 |
| Forms | React Hook Form 7 |
| HTTP | Axios |
| Realtime | Native `EventSource` (SSE) |
| Icons / Fonts | Font Awesome 6, Inter |

## Documentation

| Document | What's inside |
|---|---|
| [`client/README.md`](./client/README.md) | Project layout, auth flow, env vars, deployment |
| [`client/docs/API_CONTRACTS.md`](./client/docs/API_CONTRACTS.md) | All backend endpoints with request / response shapes |
| [`client/docs/SSE_NOTIFICATIONS_QUICKSTART.md`](./client/docs/SSE_NOTIFICATIONS_QUICKSTART.md) | How realtime notifications work end-to-end |
| [`client/docs/UX_FEEDBACK.md`](./client/docs/UX_FEEDBACK.md) | UX notes & known issues |

## Deployment

```bash
VITE_API_URL=https://api.your-domain.app npm run build
# upload client/dist/ to any static host (Vercel, Netlify, Cloudflare Pages…)
```

The static host **must** serve `index.html` for unknown routes (SPA
fallback) — otherwise React Router will 404 on hard refresh.

For details (CORS, SSE buffering, hosting tips) see the deployment section
in `client/README.md`.
