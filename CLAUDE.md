# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vemetric is an open-source web and product analytics platform built as a monorepo using Turborepo and bun. It provides real-time analytics, behavior tracking, custom event tracking, and powerful filtering mechanisms.

## Architecture

**Microservices Structure:**

- **webapp**: React frontend (port 4000) - Analytics dashboard and user interface
- **backend**: Bun + Hono API server - Main application API with tRPC
- **hub**: Bun + Hono - Event collection service (`/e` for events, `/i` for identification)
- **worker**: Background job processor using BullMQ and Redis
- **bullboard**: Queue monitoring dashboard
- **health-check**: Service health monitoring

**Data Layer:**

- **PostgreSQL**: User accounts, projects, organizations (via Prisma ORM)
- **ClickHouse**: High-volume analytics data (events, sessions, devices)
- **Redis**: Caching and job queues

## Common Development Commands

```bash
# Development (starts all services except health-check)
bun dev

# Quick Typecheck for all applications
bun run tsc

# Build all applications
bun run build

# Lint all applications
bun lint

# Run tests
bun run test
```

## Key Technologies

- **Runtime**: Bun (backend services)
- **Frontend**: React 18 + TypeScript + Vite + Chakra UI v3
- **Backend**: Hono + tRPC + Better Auth
- **State Management**: TanStack Query + Valtio
- **Routing**: TanStack Router
- **Validation**: Zod throughout the stack
- **Queue System**: BullMQ with Redis
- **Logging**: Pino with Axiom integration

## Database Schema

Two-database architecture:

- **PostgreSQL**: Relational data (users, projects, organizations, billing)
- **ClickHouse**: Analytics data optimized for time-series queries (events, sessions, devices, page views)

Database packages:

- `packages/database`: PostgreSQL/Prisma models and migrations
- `packages/clickhouse`: ClickHouse client and analytics schema

## Shared Packages

- `packages/common`: Shared utilities and types
- `packages/logger`: Centralized logging with Pino
- `packages/email`: Transactional email handling
- `packages/queues`: BullMQ job queue abstractions
- `packages/eslint-config`: Shared ESLint configurations
- `packages/tsconfig`: TypeScript configuration presets

## Development Workflow

1. **Type Safety**: The entire stack uses TypeScript with strict type checking
2. **API Layer**: tRPC provides end-to-end type safety between frontend and backend
3. **Authentication**: Better Auth handles user sessions and authentication
4. **Event Processing**: Hub collects events → Worker processes via queues → Stored in ClickHouse
5. **Real-time Updates**: Frontend uses TanStack Query for data fetching and caching

## Testing

- **Framework**: Vitest for all packages
- **Frontend Testing**: React Testing Library + jsdom
- **Run tests**: `bun run test` (all) or `cd apps/[app] && bun run test` (specific)

## Build & Deployment

- **Build System**: Turborepo orchestrates builds across all packages
- **Package Manager**: bun
- **Containerization**: Docker support available
- **Hot Reload**: Bun's `--hot` flag for backend development

## Important Notes

- **Port 4000**: Frontend webapp default port
- **Monorepo**: Use workspace dependencies (`workspace:*`) for internal packages
- **Code Style**: ESLint enforced with max 0 warnings
- **Event Tracking**: Core functionality revolves around `/e` (events) and `/i` (identification) endpoints
- **Queue Processing**: Background jobs handle data processing, user identification, and email sending
