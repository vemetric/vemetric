import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickhouseClient } from '../src/client';
import { clickhouseDeletion } from '../src/models/deletion';

vi.mock('../src/client', () => ({ clickhouseClient: { query: vi.fn(), command: vi.fn() } }));

type Mutation = { table: string; mutation_id: string; latest_fail_reason: string };
type TableColumns = { table: string; columns: string[] };

// The database as the deletion table list expects it.
const SCHEMA: TableColumns[] = [
  { table: '_migrations', columns: ['version', 'checksum'] },
  { table: 'event', columns: ['projectId', 'userId', 'createdAt'] },
  { table: 'session_v3', columns: ['projectId', 'userId', 'startedAt'] },
  { table: 'device_v2', columns: ['projectId', 'userId', 'id', 'createdAt'] },
  { table: 'user', columns: ['projectId', 'id', 'identifier', 'createdAt'] },
];

// Answers the queries in the order deletion.ts sends them: table list check, server time, then one
// `system.mutations` poll per entry of `polls`.
function mockQueries(polls: Mutation[][], schema: TableColumns[] = SCHEMA) {
  const answers: unknown[][] = [schema, [{ now: '2026-11-18 03:00:00' }], ...polls];
  vi.mocked(clickhouseClient.query).mockImplementation(
    async () => ({ json: async () => answers.shift() ?? [] }) as never,
  );
}

const commands = () => vi.mocked(clickhouseClient.command).mock.calls.map(([params]) => params.query);

describe('clickhouseDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes projects from every listed table, waiting while ClickHouse retries a failed mutation', async () => {
    const failing = { table: 'event', mutation_id: 'mutation_1.txt', latest_fail_reason: 'Memory limit exceeded' };
    mockQueries([[failing], [{ ...failing, latest_fail_reason: '' }], []]);

    const done = clickhouseDeletion.deleteProjects(['1', '2'], 60_000);
    await vi.runAllTimersAsync();

    await expect(done).resolves.toBeUndefined();
    expect(commands()).toEqual([
      'DELETE FROM `event` WHERE projectId IN (1, 2)',
      'DELETE FROM `session_v3` WHERE projectId IN (1, 2)',
      'DELETE FROM `device_v2` WHERE projectId IN (1, 2)',
      'DELETE FROM `user` WHERE projectId IN (1, 2)',
    ]);
  });

  it('deletes single users with the user id column of each table', async () => {
    mockQueries([[]]);

    await clickhouseDeletion.deleteProjectUsers('5', ['10', '11'], 60_000);

    expect(commands()).toEqual([
      'DELETE FROM `event` WHERE projectId = 5 AND userId IN (10, 11)',
      'DELETE FROM `session_v3` WHERE projectId = 5 AND userId IN (10, 11)',
      'DELETE FROM `device_v2` WHERE projectId = 5 AND userId IN (10, 11)',
      'DELETE FROM `user` WHERE projectId = 5 AND id IN (10, 11)',
    ]);
  });

  it('deletes only what the users tracked before a time', async () => {
    mockQueries([[]]);

    await clickhouseDeletion.deleteProjectUsers('5', ['10'], 60_000, new Date('2026-11-20T13:54:00.123Z'));

    const before = "toDateTime64('2026-11-20 13:54:00.123', 3, 'UTC')";
    expect(commands()).toEqual([
      `DELETE FROM \`event\` WHERE projectId = 5 AND userId IN (10) AND createdAt < ${before}`,
      `DELETE FROM \`session_v3\` WHERE projectId = 5 AND userId IN (10) AND startedAt < ${before}`,
      `DELETE FROM \`device_v2\` WHERE projectId = 5 AND userId IN (10) AND createdAt < ${before}`,
      `DELETE FROM \`user\` WHERE projectId = 5 AND id IN (10) AND createdAt < ${before}`,
    ]);
  });

  it('kills its unfinished mutations at the deadline and reports the last failure', async () => {
    const stuck = { table: 'event', mutation_id: 'mutation_7.txt', latest_fail_reason: 'Too many parts' };
    mockQueries(Array.from({ length: 10 }, () => [stuck]));

    const done = clickhouseDeletion.deleteProjects(['1'], 12_000);
    const assertion = expect(done).rejects.toThrow(
      'Mutations not done after 12s, killed: event mutation_7.txt. Last failure: event: Too many parts',
    );
    await vi.runAllTimersAsync();
    await assertion;

    expect(commands()).toContain(
      "KILL MUTATION WHERE database = currentDatabase() AND (table, mutation_id) IN (('event', 'mutation_7.txt'))",
    );
  });

  it('refuses to run when a table with projectId is missing in the list', async () => {
    mockQueries([], [...SCHEMA, { table: 'pageview_daily', columns: ['projectId', 'date'] }]);

    await expect(clickhouseDeletion.deleteProjects(['1'])).rejects.toThrow(
      'tables with projectId missing in DELETION_TABLES: pageview_daily',
    );
    expect(commands()).toEqual([]);
  });

  it('refuses to run when a listed table or its user id column is gone', async () => {
    const renamed = SCHEMA.filter((entry) => entry.table !== 'device_v2').concat({
      table: 'device_v3',
      columns: ['projectId', 'userId'],
    });
    mockQueries([], renamed);

    await expect(clickhouseDeletion.applyDeletedMasks()).rejects.toThrow(
      /missing in DELETION_TABLES: device_v3; DELETION_TABLES entries not found in the database: device_v2/,
    );
    expect(commands()).toEqual([]);
  });

  it('rejects ids that are not numeric before sending anything', async () => {
    mockQueries([]);
    await expect(clickhouseDeletion.deleteProjects(['1; DROP TABLE event'])).rejects.toThrow('Unexpected id');
    expect(commands()).toEqual([]);
  });
});
