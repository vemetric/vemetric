FROM oven/bun:1.3.11-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app

FROM base AS pruner
RUN bun add -g turbo@2.6.1
COPY . .
RUN bun turbo prune database clickhouse --docker --out-dir out

FROM base AS install
COPY --from=pruner /usr/src/app/out/json/ .
# Scripts are required here: the Prisma CLI downloads its engines during postinstall.
RUN bun install --frozen-lockfile

FROM base AS release
COPY --from=pruner /usr/src/app/out/full/ ./
COPY --from=install /usr/src/app/node_modules ./node_modules
COPY docker/migrate-entrypoint.sh /usr/local/bin/migrate-entrypoint.sh
RUN chmod +x /usr/local/bin/migrate-entrypoint.sh

CMD [ "/usr/local/bin/migrate-entrypoint.sh" ]
