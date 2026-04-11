FROM oven/bun:1.3.11-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl wget && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app

FROM base AS pruner
RUN bun add -g turbo@2.6.1
COPY . .
RUN bun turbo prune hub --docker --out-dir out

FROM base AS install
COPY --from=pruner /usr/src/app/out/json/ .
RUN bun install --ignore-scripts --frozen-lockfile

FROM install AS build
COPY --from=pruner /usr/src/app/out/full/ .
RUN bun turbo run build --filter=hub

FROM base AS prod-install
COPY --from=pruner /usr/src/app/out/json/ .
RUN bun install --production --ignore-scripts --frozen-lockfile

FROM base AS release
COPY --from=pruner /usr/src/app/out/full/ ./
COPY --from=prod-install /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/node_modules/.prisma ./node_modules/.prisma
 
EXPOSE 4004
 
CMD [ "bun", "run", "apps/hub/src/index.ts" ]
