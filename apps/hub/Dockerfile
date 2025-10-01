FROM node:20.9.0-slim AS base
# OpenSSL required for prisma
RUN apt-get update && apt-get install -y openssl curl
RUN npm i -g pnpm@9.1.3
RUN npm i -g bun@1.1.38


FROM base AS install
WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml bun.lockb .npmrc ./
COPY apps/hub/package.json ./apps/hub/
COPY apps/backend/package.json ./apps/backend/
COPY apps/worker/package.json ./apps/worker/
COPY apps/bullboard/package.json ./apps/bullboard/
COPY apps/health-check/package.json ./apps/health-check/
COPY apps/dev-proxy/package.json ./apps/dev-proxy/
COPY packages/clickhouse/package.json ./packages/clickhouse/
COPY packages/common/package.json ./packages/common/
COPY packages/database/package.json ./packages/database/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/email/package.json ./packages/email/
COPY packages/queues/package.json ./packages/queues/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/logger/package.json ./packages/logger/

RUN pnpm install --frozen-lockfile
RUN bun install --ignore-scripts


FROM install AS release
WORKDIR /usr/src/app

COPY . .
RUN rm -r apps/webapp

RUN pnpm run build
 
EXPOSE 4004
 
CMD [ "bun", "run", "apps/hub/src/index.ts" ]