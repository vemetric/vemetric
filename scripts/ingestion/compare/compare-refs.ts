/* eslint-disable no-console */
/**
 * Runs the same ingestion scenario through two code versions and diffs the resulting analytics
 * state. See scripts/ingestion/README.md.
 *
 *   bun run compare -- [--base main] [--head .] [--replicas 1]
 *
 * `.` is the current checkout including uncommitted changes; other refs run in a git worktree.
 */
import { copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { checkoutFor, childEnv, recreateDatabases, run, toolsRedisUrl, workDir } from '../lib/services';

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    base: { type: 'string', default: 'main' },
    head: { type: 'string', default: '.' },
    replicas: { type: 'string', default: '1' },
  },
});

const scenarioFile = 'ingestion-compare.integration.test.ts';

async function snapshot(side: 'base' | 'head', ref: string, redisDb: number) {
  const checkout = await checkoutFor(ref);
  console.log(`[${side}] ${ref}: preparing databases`);
  const { clickhouseDb, databaseUrl } = await recreateDatabases(`vm_compare_${side}`, checkout);
  const out = join(workDir, `compare-${side}.json`);
  const target = join(checkout, 'apps/hub/tests', scenarioFile);
  copyFileSync(join(import.meta.dir, 'scenario.integration.test.ts'), target);
  try {
    console.log(`[${side}] ${ref}: running scenario`);
    await run(['bunx', 'vitest', 'run', '--config', 'vitest.integration.config.ts', `tests/${scenarioFile}`], {
      cwd: join(checkout, 'apps/hub'),
      env: childEnv({
        CLICKHOUSE_DB: clickhouseDb,
        DATABASE_URL: databaseUrl,
        REDIS_URL: toolsRedisUrl(redisDb),
        INGESTION_COMPARE_OUT: out,
        INGESTION_COMPARE_REPLICAS: args.replicas,
      }),
      quiet: true,
    });
  } finally {
    rmSync(target, { force: true });
  }
  return (await Bun.file(out).json()) as unknown;
}

function diff(path: string, base: unknown, head: unknown, out: string[]) {
  if (JSON.stringify(base) === JSON.stringify(head)) return;
  if (Array.isArray(base) && Array.isArray(head) && base.length === head.length) {
    base.forEach((item, index) => diff(`${path}[${index}]`, item, head[index], out));
  } else if (base && head && typeof base === 'object' && typeof head === 'object' && !Array.isArray(base)) {
    const keys = new Set([...Object.keys(base), ...Object.keys(head)]);
    for (const key of keys) diff(`${path}.${key}`, (base as any)[key], (head as any)[key], out);
  } else {
    out.push(
      `${path}\n    base: ${JSON.stringify(base)?.slice(0, 300)}\n    head: ${JSON.stringify(head)?.slice(0, 300)}`,
    );
  }
}

const base = await snapshot('base', args.base, 1);
const head = await snapshot('head', args.head, 2);
const differences: string[] = [];
diff('', base, head, differences);

const sizes = Object.entries(base as Record<string, unknown>)
  .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.length : Object.keys(value as object).length}`)
  .join(', ');
if (differences.length === 0) {
  console.log(`\nNo differences (${sizes}). Snapshots: ${workDir}/compare-{base,head}.json`);
} else {
  console.log(`\n${differences.length} difference(s) between ${args.base} and ${args.head}:\n`);
  for (const line of differences.slice(0, 50)) console.log(`  ${line}`);
  console.log(`\nSnapshots: ${workDir}/compare-{base,head}.json`);
  process.exitCode = 1;
}
