FROM oven/bun:1.3.11-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app

FROM base AS pruner
RUN bun add -g turbo@2.6.1
COPY . .
RUN bun turbo prune worker --docker --out-dir out

FROM base AS install
COPY --from=pruner /usr/src/app/out/json/ .
RUN bun install --ignore-scripts --frozen-lockfile

FROM install AS build
COPY --from=pruner /usr/src/app/out/full/ .
RUN bun turbo run build --filter=worker

FROM base AS release
COPY --from=build /usr/src/app ./
 
EXPOSE 4101
 
CMD [ "bun", "run", "apps/worker/src/index.ts" ]
