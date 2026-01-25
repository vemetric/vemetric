# Repository Guidelines

## Project Structure & Module Organization
- `apps/` contains runnable services (e.g., `webapp`, `backend`, `hub`, `worker`, `bullboard`, `health-check`).
- `packages/` holds shared libraries (e.g., `common`, `database`, `clickhouse`, `queues`, `logger`).
- Root config includes `turbo.json`, `docker-compose.yml`, and shared tooling in `packages/eslint-config` and `packages/tsconfig`.

## Build, Test, and Development Commands
Use Bun from the repo root (see `package.json` scripts):
```bash
bun install
bun dev            # Run all services via Turborepo
bun run build      # Build all packages/apps (excluding dev-proxy)
bun run lint       # Lint all workspaces
bun run tsc        # Type-check all workspaces
bun run test       # Run unit tests
bun run test:watch # Watch tests
bun run e2e        # End-to-end tests (apps/e2e)
bun run format     # Prettier formatting
```
Local services are expected via Docker:
```bash
docker-compose up -d
```
Common DB setup (see `CONTRIBUTING.md`):
```bash
bun --filter database db:generate
bun --filter database db:deploy
bun --filter clickhouse migrate-local
```

## Coding Style & Naming Conventions
- Prettier is the source of truth (`.prettierrc.js`): 2-space indentation, semicolons, single quotes, print width 120.
- ESLint rules are shared via `packages/eslint-config`; run `bun run lint` before PRs.
- Prefer descriptive, kebab-case package/app names and colocate new modules with their domain.

## Testing Guidelines
- Unit tests use Vitest and live next to source files (e.g., `Button.test.tsx`).
- Filtered runs are encouraged during development:
```bash
bun --filter webapp test
bun --filter webapp test:watch
```
- E2E tests run from `apps/e2e` via `bun run e2e`.

## Commit & Pull Request Guidelines
- Commit messages in history are short, sentence-case, and action-oriented (e.g., "Rename AWS_S3_ENDPOINT").
- PRs should include a clear description, link related issues, and add screenshots for UI changes.
- Ensure CLA signing when prompted, and run `bun run lint`, `bun run test`, and `bun run build`.

## Configuration & Security Notes
- Copy `.env.example` to `.env` and keep secrets out of git.
- Security concerns should follow `SECURITY.md` guidance.
