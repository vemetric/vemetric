# TanStack Start Migration Plan

## Executive Summary

Migrate from the current architecture (Vite SPA + Hono backend as separate services) to a unified TanStack Start full-stack application. This consolidates `apps/webapp` and `apps/backend` into a single `apps/app` service.

**Current Architecture:**
```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Cloudflare Pages  │     │   Coolify/Docker    │     │   Coolify/Docker    │
│   app.vemetric.com  │────▶│ backend.vemetric.com│     │  hub.vemetric.com   │
│   (Static SPA)      │     │   (Hono + tRPC)     │     │  (Event Collection) │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

**Target Architecture:**
```
┌─────────────────────────────────────┐     ┌─────────────────────┐
│          Coolify/Docker             │     │   Coolify/Docker    │
│        app.vemetric.com             │     │  hub.vemetric.com   │
│  (TanStack Start: SSR + API + SPA)  │     │  (Event Collection) │
└─────────────────────────────────────┘     └─────────────────────┘
```

---

## Phase 0: Preparation & Research

### 0.1 Dependency Audit
- [ ] Verify TanStack Start compatibility with current dependencies
- [ ] Check Better Auth integration patterns for TanStack Start
- [ ] Verify tRPC adapter availability for TanStack Start/Vinxi
- [ ] Review Chakra UI v3 SSR compatibility (emotion, color mode)
- [ ] Check VitePWA compatibility or alternative for TanStack Start

### 0.2 Local Environment Setup
- [ ] Create feature branch for migration
- [ ] Document current environment variables for both apps
- [ ] Backup current `apps/webapp` and `apps/backend` (git handles this)

### 0.3 TanStack Start Version Decision
- [ ] Evaluate TanStack Start stable version vs latest
- [ ] Review breaking changes and migration guides
- [ ] Decision: Use `@tanstack/react-start` (currently in beta, but stable enough)

---

## Phase 1: Project Scaffolding

### 1.1 Create New App Structure
```
apps/
├── app/                    # NEW: TanStack Start application
│   ├── app/
│   │   ├── routes/         # File-based routing (migrated from webapp/src/pages)
│   │   ├── components/     # React components (from webapp/src/components)
│   │   ├── utils/          # Utilities (merged from both)
│   │   ├── hooks/          # React hooks (from webapp/src/hooks)
│   │   ├── stores/         # Valtio stores (from webapp/src/stores)
│   │   ├── styles/         # Global styles
│   │   ├── server/         # Server-only code
│   │   │   ├── trpc/       # tRPC router (from backend/src/routes)
│   │   │   ├── auth/       # Better Auth setup (from backend/src/utils/auth.ts)
│   │   │   └── utils/      # Server utilities
│   │   ├── client.tsx      # Client entry
│   │   ├── router.tsx      # Router configuration
│   │   └── ssr.tsx         # SSR entry
│   ├── public/             # Static assets
│   ├── app.config.ts       # TanStack Start config
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── webapp/                 # DEPRECATED: Remove after migration
├── backend/                # DEPRECATED: Remove after migration
├── hub/                    # UNCHANGED
├── worker/                 # UNCHANGED
├── dev-proxy/              # MODIFIED: Remove backend routing
└── ...
```

### 1.2 Initialize TanStack Start Project
```bash
# In apps/app directory
bun create @tanstack/start app
# Or manual setup with proper dependencies
```

**Key Dependencies:**
```json
{
  "dependencies": {
    "@tanstack/react-start": "^1.x",
    "@tanstack/react-router": "^1.x",
    "@tanstack/react-query": "^5.x",
    "vinxi": "^0.5.x",
    "@trpc/server": "^11.x",
    "@trpc/client": "^11.x",
    "@trpc/tanstack-react-query": "^11.x",
    "better-auth": "^1.x",
    "hono": "^4.x",
    "superjson": "^2.x",
    "@chakra-ui/react": "^3.x"
  }
}
```

### 1.3 Configure Build System
- [ ] Create `app.config.ts` with Vinxi configuration
- [ ] Configure server runtime (bun)
- [ ] Set up environment variable handling
- [ ] Configure static asset handling

---

## Phase 2: Server Infrastructure Migration

### 2.1 tRPC Integration

**Option A: tRPC as API Handler (Recommended)**
```typescript
// app/server/trpc/index.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './router';

export async function handleTRPCRequest(request: Request) {
  return fetchRequestHandler({
    endpoint: '/trpc',
    req: request,
    router: appRouter,
    createContext: (opts) => createContext(opts),
  });
}
```

**Option B: tRPC with Server Functions**
- Use `createServerFn` for specific procedures
- Keep tRPC for complex queries

**Decision: Use Option A** - Minimal changes to existing tRPC setup, proven pattern.

### 2.2 Migrate tRPC Router
- [ ] Copy `apps/backend/src/routes/*.ts` → `apps/app/app/server/trpc/routes/`
- [ ] Copy `apps/backend/src/utils/trpc.ts` → `apps/app/app/server/trpc/trpc.ts`
- [ ] Update imports to use new paths
- [ ] Adapt context creation for TanStack Start request handling

**Files to migrate:**
```
backend/src/routes/account.ts      → app/server/trpc/routes/account.ts
backend/src/routes/billing.ts      → app/server/trpc/routes/billing.ts
backend/src/routes/dashboard.ts    → app/server/trpc/routes/dashboard.ts
backend/src/routes/events.ts       → app/server/trpc/routes/events.ts
backend/src/routes/filters.ts      → app/server/trpc/routes/filters.ts
backend/src/routes/funnels.ts      → app/server/trpc/routes/funnels.ts
backend/src/routes/organization.ts → app/server/trpc/routes/organization.ts
backend/src/routes/projects.ts     → app/server/trpc/routes/projects.ts
backend/src/routes/users.ts        → app/server/trpc/routes/users.ts
backend/src/utils/trpc.ts          → app/server/trpc/trpc.ts
```

### 2.3 Better Auth Integration

**Server Setup:**
```typescript
// app/server/auth/index.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prismaClient } from '@vemetric/database';

export const auth = betterAuth({
  basePath: '/auth',
  // ... existing config from backend/src/utils/auth.ts
});

// Export handler for API routes
export const authHandler = auth.handler;
```

**Client Setup:**
```typescript
// app/utils/auth.ts
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: '/auth', // Same origin now!
});
```

**Key Changes:**
- No more cross-origin authentication
- Cookies work on same domain
- Simplified CORS (not needed for auth)

### 2.4 API Routes Setup

Create catch-all API routes in TanStack Start:

```typescript
// app/routes/api/trpc/$.tsx
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { handleTRPCRequest } from '~/server/trpc';

export const APIRoute = createAPIFileRoute('/api/trpc/$')({
  GET: ({ request }) => handleTRPCRequest(request),
  POST: ({ request }) => handleTRPCRequest(request),
});
```

```typescript
// app/routes/api/auth/$.tsx
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { authHandler } from '~/server/auth';

export const APIRoute = createAPIFileRoute('/api/auth/$')({
  GET: ({ request }) => authHandler(request),
  POST: ({ request }) => authHandler(request),
});
```

### 2.5 Additional API Routes
- [ ] Migrate `/email/unsubscribe` endpoint
- [ ] Migrate Paddle webhook handler (`/paddle/webhook`)
- [ ] Health check endpoint (`/up` or `/health`)

---

## Phase 3: Frontend Migration

### 3.1 Route Structure Migration

**TanStack Router → TanStack Start routing changes:**

| Current (webapp/src/pages) | Target (app/routes) |
|---------------------------|---------------------|
| `__root.tsx` | `__root.tsx` |
| `_layout.tsx` | `_layout.tsx` |
| `_layout/p/$projectId.tsx` | `_layout/p/$projectId.tsx` |
| `_layout/p/$projectId/index.tsx` | `_layout/p/$projectId/index.tsx` |
| `_auth.tsx` | `_auth.tsx` |
| `_auth/login.tsx` | `_auth/login.tsx` |
| ... | ... |

**Key differences in TanStack Start:**
- Routes can have `loader` functions that run on server
- API routes use `createAPIFileRoute`
- File-based routing structure is similar but with enhanced capabilities

### 3.2 Migrate Route Files
- [ ] Copy all route files from `webapp/src/pages/` → `app/routes/`
- [ ] Update imports (relative paths change)
- [ ] Keep routes as client-side initially (add `'use client'` or configure in router)

**Route migration checklist:**
```
webapp/src/pages/
├── __root.tsx                    ✓ → app/routes/__root.tsx
├── _layout.tsx                   ✓ → app/routes/_layout.tsx
├── _layout/
│   ├── billing.tsx               ✓
│   ├── p/$projectId.tsx          ✓
│   ├── p/$projectId/index.tsx    ✓
│   ├── p/$projectId/events/      ✓
│   ├── p/$projectId/funnels/     ✓
│   ├── p/$projectId/users/       ✓
│   └── o/$organizationId/        ✓
├── _auth.tsx                     ✓
├── _auth/login.tsx               ✓
├── _auth/signup.tsx              ✓
├── _auth/reset-password.tsx      ✓
├── onboarding/                   ✓
├── public/$domain.tsx            ✓ (candidate for SSR)
├── email/                        ✓
└── index.tsx                     ✓
```

### 3.3 Migrate Components
- [ ] Copy `webapp/src/components/` → `app/components/`
- [ ] Update all import paths
- [ ] Verify Chakra UI components work in SSR context

### 3.4 Migrate Utilities & Hooks
- [ ] Copy `webapp/src/utils/` → `app/utils/`
- [ ] Copy `webapp/src/hooks/` → `app/hooks/`
- [ ] Copy `webapp/src/stores/` → `app/stores/`
- [ ] **Critical:** Update `url.ts` - backend URL no longer needed

**URL utility changes:**
```typescript
// OLD (webapp/src/utils/url.ts)
export function getBackendUrl() {
  return getUrl('backend'); // https://backend.vemetric.com
}

// NEW (app/utils/url.ts)
export function getApiUrl() {
  return ''; // Same origin - relative URLs work
}

// Hub URL remains unchanged
export function getHubUrl() {
  return getUrl('hub'); // https://hub.vemetric.com
}
```

### 3.5 Migrate tRPC Client
```typescript
// app/utils/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '~/server/trpc/router';

export const trpc = createTRPCReact<AppRouter>();

// Client setup - URL changes to relative
const url = '/api/trpc';
```

### 3.6 Migrate Static Assets
- [ ] Copy `webapp/public/` → `app/public/`
- [ ] Update `index.html` equivalent in TanStack Start
- [ ] Verify favicon, manifest, and PWA assets

### 3.7 Chakra UI SSR Setup
```typescript
// app/components/providers.tsx
import { ChakraProvider, createSystem, defaultConfig } from '@chakra-ui/react';
import { ColorModeProvider } from '~/components/ui/color-mode';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider>
        {children}
      </ColorModeProvider>
    </ChakraProvider>
  );
}
```

---

## Phase 4: Configuration & Environment

### 4.1 Environment Variables

**Consolidate from both apps:**

```bash
# Database (from backend)
DATABASE_URL=
DIRECT_DATABASE_URL=

# ClickHouse (from backend)
CLICKHOUSE_HOST=
CLICKHOUSE_DATABASE=
CLICKHOUSE_USERNAME=
CLICKHOUSE_PASSWORD=

# Redis (from backend)
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=

# Auth (from backend)
BETTER_AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Billing (from backend)
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=

# Storage (from backend)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_ENDPOINT=
AWS_S3_AVATARS_BUCKET=
AWS_S3_AVATARS_PUBLIC_URL=
AWS_S3_AVATARS_KEY_PREFIX=

# Monitoring (from backend)
SENTRY_DSN=
AXIOM_DATASET=
AXIOM_TOKEN=

# App Config (new/modified)
DOMAIN=vemetric.com
PORT=4003
NODE_ENV=production

# Frontend-only (from webapp, now server-accessible too)
VITE_PADDLE_TOKEN=
VITE_PADDLE_ENVIRONMENT=
VITE_GOOGLE_MAPS_API_KEY=
```

### 4.2 TanStack Start Configuration
```typescript
// app.config.ts
import { defineConfig } from '@tanstack/react-start/config';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  server: {
    preset: 'bun',
    // or 'node' if bun has issues
  },
  vite: {
    plugins: [viteTsConfigPaths()],
    // PWA plugin if needed
  },
  routers: {
    client: {
      entry: './app/client.tsx',
    },
    server: {
      entry: './app/ssr.tsx',
    },
    api: {
      entry: './app/api.tsx',
    },
  },
});
```

### 4.3 TypeScript Configuration
```json
// tsconfig.json
{
  "extends": "@vemetric/tsconfig/react.json",
  "compilerOptions": {
    "paths": {
      "~/*": ["./app/*"]
    },
    "types": ["vinxi/types/client", "vinxi/types/server"]
  },
  "include": ["app/**/*", "app.config.ts"]
}
```

---

## Phase 5: Development Environment

### 5.1 Update Dev Proxy

**Modify `apps/dev-proxy/src/index.ts`:**

```typescript
// Remove backend proxy, update app proxy
const routes: Record<string, string> = {
  'vemetric.localhost': 'http://localhost:4001',      // Landing page
  'app.vemetric.localhost': 'http://localhost:4003',  // TanStack Start app (was 4000)
  // 'backend.vemetric.localhost' - REMOVED
  'hub.vemetric.localhost': 'http://localhost:4004',  // Hub (unchanged)
  'bullboard.vemetric.localhost': 'http://localhost:4121', // Bullboard
};
```

### 5.2 Update Root package.json

```json
{
  "scripts": {
    "dev": "turbo run dev --filter=!./apps/health-check --filter=!./apps/webapp --filter=!./apps/backend",
    "build": "turbo run build --filter=!./apps/dev-proxy --filter=!./apps/webapp --filter=!./apps/backend"
  }
}
```

### 5.3 Turbo Configuration
```json
// turbo.json - add app to pipeline
{
  "tasks": {
    "build": {
      "dependsOn": ["^db:generate", "^build"],
      "outputs": [".output/**", "dist/**"]
    }
  }
}
```

---

## Phase 6: Docker & Deployment

### 6.1 Create Dockerfile for TanStack Start App

```dockerfile
# apps/app/Dockerfile
FROM oven/bun:1.2.23 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock* ./
COPY apps/app/package.json ./apps/app/
COPY packages/database/package.json ./packages/database/
COPY packages/clickhouse/package.json ./packages/clickhouse/
COPY packages/common/package.json ./packages/common/
COPY packages/logger/package.json ./packages/logger/
COPY packages/queues/package.json ./packages/queues/
COPY packages/tsconfig/package.json ./packages/tsconfig/
RUN bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
# Generate Prisma client
RUN bun run --filter=@vemetric/database db:generate
# Build the app
RUN bun run --filter=app build

# Production
FROM base AS release
COPY --from=build /app/apps/app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=4003
EXPOSE 4003

CMD ["bun", "run", ".output/server/index.mjs"]
```

### 6.2 Docker Compose Update (if using)

```yaml
services:
  app:
    build:
      context: .
      dockerfile: apps/app/Dockerfile
    ports:
      - "4003:4003"
    environment:
      - DATABASE_URL
      - REDIS_HOST
      # ... all env vars
    depends_on:
      - postgres
      - redis
      - clickhouse
```

---

## Phase 7: Infrastructure & DNS Changes

### 7.1 Cloudflare DNS Updates

**Before Migration (Current):**
| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | app | [cloudflare-pages] | Yes |
| A/CNAME | backend | [coolify-server-ip] | Yes |
| A/CNAME | hub | [coolify-server-ip] | Yes |

**After Migration:**
| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A/CNAME | app | [coolify-server-ip] | Yes |
| A/CNAME | hub | [coolify-server-ip] | Yes |
| ~~backend~~ | - | DELETED or redirect | - |

### 7.2 Cloudflare Cache Rules

**Update cache rules for app.vemetric.com:**
```
# Static assets - cache aggressively
/_build/*          Cache: 1 year
/assets/*          Cache: 1 year
*.js, *.css        Cache: 1 year (with hash in filename)

# API routes - no cache
/api/*             Cache: bypass
/trpc/*            Cache: bypass
/auth/*            Cache: bypass

# HTML pages - short cache or bypass
/                  Cache: bypass or short TTL
/*                 Cache: bypass (for SSR pages)
```

### 7.3 Cloudflare Page Rules / Redirects

**Redirect old backend URLs (optional, for transition):**
```
backend.vemetric.com/* → app.vemetric.com/api/$1 (301)
```

Or simply remove and let it 404 (cleaner).

### 7.4 Coolify Deployment Setup

**New Service: `app`**
1. Create new service in Coolify
2. Source: Git repository, `apps/app` directory
3. Build: Dockerfile (`apps/app/Dockerfile`)
4. Port: 4003
5. Domain: `app.vemetric.com`
6. Environment variables: Copy from backend + add new ones

**Traefik Labels (auto-configured by Coolify):**
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.app.rule=Host(`app.vemetric.com`)"
  - "traefik.http.routers.app.entrypoints=websecure"
  - "traefik.http.routers.app.tls.certresolver=letsencrypt"
  - "traefik.http.services.app.loadbalancer.server.port=4003"
```

### 7.5 Coolify Cleanup

**After successful migration:**
1. Stop and remove `backend` service
2. Stop and remove `webapp` service (if any)
3. Delete Cloudflare Pages project for webapp
4. Remove DNS record for `backend.vemetric.com`

---

## Phase 8: Testing & Validation

### 8.1 Local Testing Checklist

**Authentication:**
- [ ] Login with email/password
- [ ] Login with Google OAuth
- [ ] Login with GitHub OAuth
- [ ] Logout
- [ ] Password reset flow
- [ ] Email verification
- [ ] Session persistence across page reloads

**Core Features:**
- [ ] Dashboard loads with data
- [ ] Project switching works
- [ ] Organization switching works
- [ ] Event filtering works
- [ ] Funnel analysis works
- [ ] User journeys display correctly
- [ ] Real-time updates work

**API Endpoints:**
- [ ] tRPC queries work
- [ ] tRPC mutations work
- [ ] Paddle webhooks work (`/api/paddle/webhook`)
- [ ] Health check endpoint works
- [ ] Email unsubscribe works

**Public Routes:**
- [ ] Public dashboard (`/public/$domain`) works
- [ ] Auth pages work for anonymous users
- [ ] Onboarding flow works

### 8.2 Performance Validation
- [ ] Initial page load time
- [ ] Time to interactive
- [ ] API response times (compare with current)
- [ ] Memory usage of server

### 8.3 Cross-Browser Testing
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

---

## Phase 9: Migration Execution

### 9.1 Pre-Migration Checklist
- [ ] All tests passing locally
- [ ] Docker image builds successfully
- [ ] Environment variables documented
- [ ] Rollback plan documented
- [ ] Team notified of migration window

### 9.2 Migration Steps (Production)

**Step 1: Deploy new app service (parallel)**
```bash
# Deploy app service to Coolify (different domain temporarily)
# e.g., app-new.vemetric.com for testing
```

**Step 2: Verify new deployment**
- [ ] All features working on test domain
- [ ] No errors in logs
- [ ] Performance acceptable

**Step 3: DNS cutover**
```bash
# Update Cloudflare DNS
# app.vemetric.com → new Coolify service IP
# (Cloudflare Pages automatically stops receiving traffic)
```

**Step 4: Verify production**
- [ ] Users can log in
- [ ] Data loading correctly
- [ ] No console errors

**Step 5: Cleanup**
```bash
# After 24-48 hours of stable operation:
# - Delete backend service from Coolify
# - Delete Cloudflare Pages project
# - Remove backend.vemetric.com DNS record
# - Archive old code (or delete after keeping git history)
```

### 9.3 Rollback Plan

**If issues arise:**
1. Revert Cloudflare DNS for `app.vemetric.com` back to Cloudflare Pages
2. Cloudflare Pages will resume serving the old SPA
3. Backend service should still be running (don't delete until verified)
4. Debug issues, fix, redeploy

---

## Phase 10: Post-Migration Tasks

### 10.1 Code Cleanup
- [ ] Delete `apps/webapp` directory
- [ ] Delete `apps/backend` directory
- [ ] Update `apps/dev-proxy` to remove backend routing
- [ ] Update root `package.json` scripts
- [ ] Update `turbo.json` pipeline
- [ ] Update CI/CD workflows (if any)
- [ ] Update `CLAUDE.md` with new architecture

### 10.2 Documentation Updates
- [ ] Update README.md with new architecture
- [ ] Update deployment documentation
- [ ] Update development setup guide
- [ ] Document new API route structure

### 10.3 Monitoring & Alerts
- [ ] Verify Sentry error tracking works
- [ ] Verify Axiom logging works
- [ ] Set up alerts for new service in Coolify
- [ ] Monitor resource usage (may differ from split architecture)

### 10.4 DNS/CDN Cleanup
- [ ] Delete `backend.vemetric.com` DNS record
- [ ] Delete Cloudflare Pages project
- [ ] Review and update Cloudflare cache rules
- [ ] Verify SSL certificates are working

### 10.5 Hardcoded URL Updates
- [ ] Update `apps/worker/src/workers/email-worker.ts` - unsubscribe link
- [ ] Update `apps/backend/src/routes/email.ts` - redirect URL
- [ ] Update email templates with new URLs
- [ ] Search codebase for `backend.vemetric.com` references

---

## Risk Assessment & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| TanStack Start bugs | High | Medium | Test thoroughly, have rollback plan |
| Auth token incompatibility | High | Low | Better Auth handles migration, test OAuth flows |
| Performance regression | Medium | Medium | Benchmark before/after, optimize if needed |
| Missing routes/features | High | Low | Comprehensive testing checklist |
| Cloudflare cache issues | Medium | Medium | Clear cache during migration, test cache rules |
| Docker build issues | Medium | Medium | Test builds locally, verify bun compatibility |

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0: Preparation | 1-2 days | None |
| Phase 1: Scaffolding | 1 day | Phase 0 |
| Phase 2: Server Migration | 2-3 days | Phase 1 |
| Phase 3: Frontend Migration | 2-3 days | Phase 2 |
| Phase 4: Configuration | 0.5 day | Phase 3 |
| Phase 5: Dev Environment | 0.5 day | Phase 4 |
| Phase 6: Docker Setup | 1 day | Phase 5 |
| Phase 7: Infrastructure | 0.5 day | Phase 6 (planning only) |
| Phase 8: Testing | 2-3 days | Phase 6 |
| Phase 9: Execution | 1 day | Phase 8 |
| Phase 10: Cleanup | 1-2 days | Phase 9 |

**Total: ~12-17 days** (can be parallelized in some areas)

---

## Open Questions / Decisions Needed

1. **PWA Support**: Keep VitePWA or drop PWA functionality? TanStack Start has different PWA patterns.

2. **SSR Strategy**: Which routes should be SSR vs client-only?
   - Candidates for SSR: `/public/$domain` (SEO), `/login`, `/signup` (SEO)
   - Client-only: Dashboard routes (authenticated, no SEO benefit)

3. **Port Number**: Keep 4003 (current backend) or use different port?

4. **API Path**: Use `/api/trpc` or `/trpc` for tRPC endpoint?

5. **Monitoring**: Keep same Sentry project or create new one for unified app?

---

## Appendix A: File Migration Reference

### Backend Files → App Server Files
```
apps/backend/src/index.ts           → apps/app/app/server/index.ts (partial)
apps/backend/src/routes/*.ts        → apps/app/app/server/trpc/routes/*.ts
apps/backend/src/utils/trpc.ts      → apps/app/app/server/trpc/trpc.ts
apps/backend/src/utils/auth.ts      → apps/app/app/server/auth/index.ts
apps/backend/src/utils/billing.ts   → apps/app/app/server/utils/billing.ts
apps/backend/types.ts               → apps/app/app/server/trpc/types.ts
```

### Webapp Files → App Client Files
```
apps/webapp/src/pages/*             → apps/app/app/routes/*
apps/webapp/src/components/*        → apps/app/app/components/*
apps/webapp/src/hooks/*             → apps/app/app/hooks/*
apps/webapp/src/utils/*             → apps/app/app/utils/*
apps/webapp/src/stores/*            → apps/app/app/stores/*
apps/webapp/src/consts/*            → apps/app/app/consts/*
apps/webapp/src/theme/*             → apps/app/app/theme/*
apps/webapp/public/*                → apps/app/public/*
apps/webapp/index.html              → (handled by TanStack Start)
apps/webapp/tsr.config.json         → (not needed, integrated in app.config.ts)
```

---

## Appendix B: Environment Variable Mapping

| Variable | Source | Required |
|----------|--------|----------|
| `DATABASE_URL` | backend | Yes |
| `DIRECT_DATABASE_URL` | backend | Yes |
| `CLICKHOUSE_*` | backend | Yes |
| `REDIS_*` | backend | Yes |
| `BETTER_AUTH_SECRET` | backend | Yes |
| `GOOGLE_CLIENT_*` | backend | Yes |
| `GITHUB_CLIENT_*` | backend | Yes |
| `PADDLE_*` | backend | Yes (billing) |
| `AWS_*` | backend | Yes (avatars) |
| `SENTRY_DSN` | backend | Optional |
| `AXIOM_*` | backend | Optional |
| `DOMAIN` | common | Yes |
| `PORT` | new | Yes (default: 4003) |
| `VITE_PADDLE_*` | webapp | Yes (client-side) |
| `VITE_GOOGLE_MAPS_*` | webapp | Optional |
