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
RUN bun run --filter=database db:generate
RUN bun run --filter=app build

# Production
FROM base AS release
COPY --from=build /app/apps/app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["bun", "run", ".output/server/index.mjs"] # Verify output path for RC 1.157.9
