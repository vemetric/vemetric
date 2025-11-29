FROM node:20.9.0-slim AS base
# OpenSSL required for prisma
RUN apt-get update && apt-get install -y openssl curl
# we're currently on bun 1.2.23 because of issues with BullMQ jobs stuck in active state
RUN npm i -g bun@1.2.23


FROM base AS install
WORKDIR /usr/src/app

COPY package.json bun.lock .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/bullboard/package.json ./apps/bullboard/
COPY apps/dev-proxy/package.json ./apps/dev-proxy/
COPY apps/health-check/package.json ./apps/health-check/
COPY apps/hub/package.json ./apps/hub/
COPY apps/webapp/package.json ./apps/webapp/
COPY apps/worker/package.json ./apps/worker/
COPY packages/clickhouse/package.json ./packages/clickhouse/
COPY packages/common/package.json ./packages/common/
COPY packages/database/package.json ./packages/database/
COPY packages/email/package.json ./packages/email/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/logger/package.json ./packages/logger/
COPY packages/queues/package.json ./packages/queues/
COPY packages/tsconfig/package.json ./packages/tsconfig/

RUN bun install --ignore-scripts --frozen-lockfile


FROM install AS release
WORKDIR /usr/src/app

COPY . .
RUN rm -r apps/webapp

RUN bun run build
 
EXPOSE 4101
 
CMD [ "bun", "run", "apps/worker/src/index.ts" ]