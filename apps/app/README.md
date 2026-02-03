# Vemetric App (SPA + API)

This app combines the Vite SPA and Hono backend into a single deployable service.
The Hono server serves the built SPA in production and exposes backend routes under `/_api`.

## Structure

- `src/frontend/` — frontend React SPA (TanStack Router + Chakra UI)
- `src/backend/` — Hono backend (tRPC, Better Auth, Paddle, metrics)

## Routes

- SPA: all non-API routes fall back to `index.html`
- Backend: `/_api/*`
- Public API (reserved): `/api/*` (currently `501 Not Implemented`)
- Health: `/_api/up`

## Development

Single dev server with HMR + API routes:

```
bun run dev
```

Vite uses `@hono/vite-dev-server` to mount the backend as middleware. The app runs on port `4000` by default.

## Production

Build:

```
bun run build
```

Run (Bun):

```
bun run start
```

Static assets are served from `dist/` by Hono. Cache headers:

- `/assets/*`: `public, max-age=31536000, immutable`
- `/workbox-*`: `public, max-age=31536000, immutable`
- `index.html`: `no-cache`, `X-Frame-Options: DENY`
- `sw.js` + `manifest.webmanifest`: `no-cache`
- All backend routes: `no-store`

## PWA

The PWA uses `vite-plugin-pwa` with:

- `autoUpdate`
- navigation fallback denylist for `/_api` and `/api`
- `NetworkFirst` for HTML navigations to keep the SPA in sync after deploys

## Docker

Use `apps/app/Dockerfile` to build a single container for the combined service.
