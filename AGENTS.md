# Repository Guidelines

## Project Structure & Module Organization
- `apps/` contains runnable services: `app` (Vite SPA + Hono API), `hub` (event ingestion), `worker` (jobs), `bullboard` (queue UI), `health-check`, and `e2e` (Playwright tests).
- `packages/` holds shared libraries such as `common`, `database` (Prisma/Postgres), `clickhouse`, `logger`, `queues`, plus shared configs (`eslint-config`, `tsconfig`).
- Root configs include `turbo.json`, `.env.example`, and `docker-compose.yml` for local services.

## Build, Test, and Development Commands
Use Bun and Turborepo from the repo root:
- `bun install` installs workspace dependencies.
- `bun dev` runs all services (except `health-check`) for local development.
- `bun run build` builds all apps/packages.
- `bun lint` runs ESLint across the monorepo.
- `bun run tsc` runs TypeScript typechecking.
- `bun run test` runs unit tests across packages.
- `bun run e2e` and `bun run e2e:ui` run Playwright end-to-end tests.

## Coding Style & Naming Conventions
- TypeScript is the default across the stack; keep types strict and explicit.
- Formatting uses Prettier (`bun run format`) for `ts/tsx/md`.
- Linting uses the shared ESLint config with max warnings set to 0.
- Test files are colocated and named `*.test.ts` or `*.test.tsx`.

## Testing Guidelines
- Unit tests use Vitest (and React Testing Library for the frontend).
- E2E tests live in `apps/e2e` and run via Playwright.
- Prefer adding tests alongside the feature or bug fix, matching existing patterns.

## Commit & Pull Request Guidelines
- Commit messages are short, descriptive, and often sentence case (e.g., “Add configurable key prefix for avatar storage”).
- PRs should include a clear description, steps to verify, and link to any relevant issues.
- First-time contributors must sign the CLA at `license/CLA.md`.

## Security & Configuration Tips
- Use `.env.example` as the template for local configuration.
- Report vulnerabilities following `SECURITY.md` rather than opening public issues.
