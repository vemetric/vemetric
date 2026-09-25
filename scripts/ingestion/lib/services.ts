/* eslint-disable no-console */
import { mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { SQL } from 'bun';

export const repoRoot = resolve(import.meta.dir, '../../..');
// Not the system temp directory: macOS purges old files there, which breaks installed worktrees.
export const workDir = join(homedir(), '.cache', 'vemetric-ingestion-tools');
mkdirSync(workDir, { recursive: true });

/**
 * The disposable Redis the tools flush. Never the application Redis from `.env`.
 * Start it with `docker compose --profile test up -d redis-test`.
 */
export function toolsRedisUrl(db: number) {
  const url = new URL(process.env.INGESTION_TOOLS_REDIS_URL ?? 'redis://localhost:16389');
  if (process.env.REDIS_URL && new URL(process.env.REDIS_URL).port === url.port) {
    throw new Error(`INGESTION_TOOLS_REDIS_URL must not point at the application Redis (${process.env.REDIS_URL})`);
  }
  url.pathname = `/${db}`;
  return url.toString();
}

/** Environment for hub/worker/test processes: application `.env`, disposable databases, no telemetry. */
export function childEnv(overrides: Record<string, string>): Record<string, string> {
  return {
    ...(process.env as Record<string, string>),
    AXIOM_TOKEN: '',
    BULLMQ_JOB_DEBUG_LOGS: 'false',
    ...overrides,
  };
}

export async function run(cmd: string[], options: { cwd: string; env?: Record<string, string>; quiet?: boolean }) {
  const proc = Bun.spawn(cmd, {
    cwd: options.cwd,
    env: options.env ?? childEnv({}),
    stdout: options.quiet ? 'pipe' : 'inherit',
    stderr: options.quiet ? 'pipe' : 'inherit',
  });
  const [code, out, err] = await Promise.all([
    proc.exited,
    options.quiet ? new Response(proc.stdout as ReadableStream).text() : '',
    options.quiet ? new Response(proc.stderr as ReadableStream).text() : '',
  ]);
  if (code !== 0) throw new Error(`${cmd.join(' ')} (in ${options.cwd}) exited with ${code}\n${out}\n${err}`);
  return out;
}

export async function clickhouseCommand(query: string, database?: string) {
  const host = process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123';
  const response = await fetch(host, {
    method: 'POST',
    body: query,
    headers: {
      'X-ClickHouse-User': process.env.CLICKHOUSE_USER ?? 'default',
      'X-ClickHouse-Key': process.env.CLICKHOUSE_PASSWORD ?? '',
      ...(database ? { 'X-ClickHouse-Database': database } : {}),
    },
  });
  if (!response.ok) throw new Error(`ClickHouse: ${await response.text()}`);
  return await response.text();
}

export async function clickhouseQuery<T>(database: string, query: string): Promise<T[]> {
  const text = await clickhouseCommand(
    `${query} SETTINGS output_format_json_quote_64bit_integers = 0 FORMAT JSONEachRow`,
    database,
  );
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

// Prisma URLs carry options such as `?schema=public` that plain Postgres clients reject.
function postgresUrl(database = 'postgres', { prisma = false } = {}) {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5433/vemetric');
  url.pathname = `/${database}`;
  if (!prisma) url.search = '';
  return url.toString();
}

/**
 * Recreates a disposable ClickHouse and PostgreSQL database named `name` and applies the
 * migrations of the given checkout, so each code version runs against its own schema.
 */
export async function recreateDatabases(name: string, checkout: string) {
  if (!/^vm_(compare|loadtest)_\w+$/.test(name)) throw new Error(`Refusing to recreate database ${name}`);
  await clickhouseCommand(`DROP DATABASE IF EXISTS ${name}`);
  await clickhouseCommand(`CREATE DATABASE ${name}`);
  await run(['bunx', 'clickhouse-migrations', 'migrate', '--migrations-home=./migrations'], {
    cwd: join(checkout, 'packages/clickhouse'),
    env: childEnv({
      CH_MIGRATIONS_HOST: process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123',
      CH_MIGRATIONS_USER: process.env.CLICKHOUSE_USER ?? 'default',
      CH_MIGRATIONS_PASSWORD: process.env.CLICKHOUSE_PASSWORD ?? '',
      CH_MIGRATIONS_DB: name,
    }),
    quiet: true,
  });

  const admin = new SQL(postgresUrl());
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.close();
  }
  await run(['bunx', 'prisma', 'migrate', 'deploy'], {
    cwd: join(checkout, 'packages/database'),
    env: childEnv({ DATABASE_URL: postgresUrl(name, { prisma: true }) }),
    quiet: true,
  });

  return { clickhouseDb: name, databaseUrl: postgresUrl(name, { prisma: true }) };
}

export async function createProject(database: string, project: { id: string; token: string; domain: string }) {
  const sql = new SQL(postgresUrl(database));
  try {
    await sql`INSERT INTO organization (id, name) VALUES (${`org-${project.id}`}, 'Ingestion tools')`;
    await sql`INSERT INTO project (id, name, domain, token, "organizationId")
      VALUES (${project.id}, 'Ingestion tools', ${project.domain}, ${project.token}, ${`org-${project.id}`})`;
  } finally {
    await sql.close();
  }
}

/**
 * A detached worktree of `ref` with installed dependencies, or the current checkout for `.`
 * (including uncommitted changes).
 */
export async function checkoutFor(ref: string) {
  if (ref === '.') return repoRoot;
  const sha = (await run(['git', 'rev-parse', '--verify', `${ref}^{commit}`], { cwd: repoRoot, quiet: true })).trim();
  const dir = join(workDir, 'worktrees', sha);
  // Written only after a complete install; anything else is recreated.
  const ready = join(dir, '.ingestion-tools-ready');
  if (!(await Bun.file(ready).exists())) {
    console.log(`Creating worktree for ${ref} (${sha.slice(0, 8)}) in ${dir}`);
    rmSync(dir, { recursive: true, force: true });
    await run(['git', 'worktree', 'prune'], { cwd: repoRoot, quiet: true });
    await run(['git', 'worktree', 'add', '--detach', dir, sha], { cwd: repoRoot, quiet: true });
    await run(['bun', 'install', '--frozen-lockfile'], { cwd: dir, quiet: true });
    await run(['bunx', 'prisma', 'generate'], { cwd: join(dir, 'packages/database'), quiet: true });
    await Bun.write(ready, sha);
  }
  return dir;
}
