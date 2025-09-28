# Contributing to Vemetric

Thank you for your interest in contributing to Vemetric! This document provides guidelines and instructions for you to get started.

## Table of Contents

- [Contributor License Agreement](#contributor-license-agreement)
- [Types of Contributions](#types-of-contributions)
- [Local Development Setup](#local-development-setup)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Documentation](#documentation)
- [Questions](#questions)

## Contributor License Agreement

If you want to contribute to Vemetric, you'll need to sign our [Contributor License Agreement (CLA)](license/CLA.md).

You'll be automatically prompted to sign it when creating your first pull request.

## Types of Contributions

We welcome the following types of contributions:

- Submitting a fix / change
- Reporting a bug
- Proposing new features
- Discussing the current state of the code

You can take a look at our [Issues on GitHub](https://github.com/vemetric/vemetric/issues) and see if there's something you'd like to tackle. If so, please add a comment that you start working on it and feel free to ask any questions.

In case you have ideas for contributing bigger changes to Vemetric, like a new feature, please first create an issue or discussion in our GitHub repository. We have a clear vision of how Vemetric should evolve and we don't want you to waste your time with things that don't align with it.

## Local Development Setup

This section will help you set up Vemetric for local development.

### Prerequisites

Before you begin, ensure you have the following installed:

- **[Bun](https://bun.sh/)** (v1.2.15 or higher) - JavaScript runtime and toolkit
- **[pnpm](https://pnpm.io/)** (v9.11.0 or higher) - Fast, disk space efficient package manager
- **[Docker](https://www.docker.com/)** and **Docker Compose** - For running local services
- **[Node.js](https://nodejs.org/)** (v20 or higher) - Required for some tooling

### Setup

Follow these steps from the root directory to get Vemetric running locally:

```bash
# 1. Clone the repository
git clone https://github.com/vemetric/vemetric.git
cd vemetric

# 2. Install dependencies
pnpm install
bun install

# 3. Start Docker services for local Development (PostgreSQL, Redis, ClickHouse)
docker-compose up -d

# 4. Wait for services to be healthy (about 30 seconds)
docker-compose ps
# All services should show as "healthy"

# 5. Copy environment example files (see Environment Variables section below)
cp .env.example .env

# 6. Run PostgreSQL migrations
pnpm --filter database db:generate
pnpm --filter database db:deploy

# 7. Run ClickHouse migrations
pnpm --filter clickhouse migrate-local

# 8. Start the development servers
pnpm dev
```

By default, Vemetric boots up a Proxy for local development that runs at port 4050. It ensures all services run under the same base domain with different subdomains.

Therefore, once everything is running, you can access:

- **Web Application**: http://app.vemetric.localhost:4050
- **Backend API**: http://backend.vemetric.localhost:4050
- **Hub (Event Ingestion)**: http://hub.vemetric.localhost:4050

In case you want to have the Dev Proxy running on a different port, just specify `VEMETRIC_DEV_PROXY_PORT` in your `.env` file in the root of the monorepo.

### Create a project

Now that Vemetric is running, you should signup at `http://app.vemetric.localhost:4050` to create an account.

Afterwards you'll be prompted to create an organization and a project. After creating a project, copy the token you'll see in the Dashboard of the newly created project.

Paste the token in the `VEMETRIC_TOKEN` variable of your `.env` file and restart the dev script with `pnpm dev`.

Now Vemetric will track itself and you should see data flowing in on your Dashboard while navigating around. Now you can test Vemetric and see local code changes being reflected in the application.

## Development Workflow

1. **Fork the repository** - Create your own fork on GitHub
2. **Create a feature branch** - Create a new branch for your feature/fix:
   ```bash
   git checkout -b fix/description
   ```
3. **Make your changes** - Write your code following our conventions
4. **Run tests** - Ensure all tests pass:
   ```bash
   pnpm test
   ```
5. **Lint your code** - Check for linting issues:
   ```bash
   pnpm lint
   ```
6. **Build the project** - Ensure it builds without errors:
   ```bash
   pnpm build
   ```
7. **Commit your changes** - Use clear, descriptive commit messages
8. **Push to your fork** - Push your branch to GitHub
9. **Submit a pull request** - Open a PR against the main repository

## Project Structure

```
vemetric/
├── apps/                  # Applications
│   ├── webapp/            # React frontend
│   ├── backend/           # Bun + Hono API server
│   ├── hub/               # Event collection service
│   ├── worker/            # Background job processor
│   ├── bullboard/         # Queue monitoring dashboard
│   └── health-check/      # Service health monitoring
└── packages/              # Shared packages
    ├── common/            # Shared utilities, logic and types
    ├── database/          # PostgreSQL/Prisma models
    ├── clickhouse/        # ClickHouse client and schema
    ├── logger/            # Centralized logging
    ├── email/             # Email service
    ├── queues/            # Job queue abstractions
    ├── eslint-config/     # Shared ESLint config
    └── tsconfig/          # TypeScript config presets
```

### Key Technologies

- **Runtime**: Bun (backend services)
- **Frontend**: React + TypeScript + Vite + Chakra UI v3
- **Backend**: Hono + tRPC + Better Auth
- **State Management**: TanStack Query (tRPC) + Valtio
- **Routing**: TanStack Router
- **Validation**: Zod throughout the stack
- **Queue System**: BullMQ with Redis
- **Logging**: Pino with Axiom integration

### Architecture Overview

- **webapp**: React frontend (Static SPA) - Analytics dashboard and user interface
- **backend**: Bun + Hono API server - Main application API with tRPC
- **hub**: Bun + Hono - Event collection service (e.g. `/e` for events, `/i` for identification)
- **worker**: Background job processor using BullMQ and Redis
- **bullboard**: Queue monitoring dashboard
- **health-check**: Service health monitoring, not needed for devlopment

**Data Layer:**

- **PostgreSQL**: User accounts, projects, organizations (via Prisma ORM)
- **ClickHouse**: High-volume analytics data (events, sessions, devices)
- **Redis**: Caching and job queues

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter webapp test

# Run tests in watch mode
pnpm --filter webapp test:watch
```

### Writing Tests

Tests use Vitest and are located alongside source files:

```
src/
components/
Button.tsx
Button.test.tsx
```

## Documentation

- At the moment the Vemetric Docs are at an external repo and not publicly available
  - Let us know which parts of the Vemetric Docs need to be changed in which way. We're working on making the source of the Vemetric Docs public as well to make this process easier.
- Keep inline documentation up to date
- Follow the existing documentation style
- Update the CLAUDE.md file when making significant architectural changes

## Code Style and Standards

### General Guidelines

- **TypeScript**: Use strict type checking throughout
- **ESLint**: All code must pass linting with 0 warnings
- **Prettier**: Format code before committing
- **Naming**: Use clear, descriptive names for variables, functions, and files
- **Comments**: Add comments for complex logic, but prefer self-documenting code

### Conventions

- **File naming**: Use kebab-case for file names (e.g., `user-service.ts`)
- **Component naming**: Use PascalCase for React components
- **Function naming**: Use camelCase for functions and variables
- **Constants**: Use UPPER_SNAKE_CASE for constants

## Questions?

Feel free to [open a new Discussion](https://github.com/vemetric/vemetric/discussions) for any questions you might have.

For more architectural details, you can also take a look at the [CLAUDE.md](./CLAUDE.md) file.
