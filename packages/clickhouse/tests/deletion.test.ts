import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickhouseClient } from '../src/client';
import { clickhouseDeletion } from '../src/models/deletion';

vi.mock('../src/client', () => ({ clickhouseClient: { query: vi.fn(), command: vi.fn() } }));

type Mutation = { table: string; mutation_id: string; latest_fail_reason: string };

// Answers the queries in the order deletion.ts sends them: table lookup, server time, then one `system.mutations`
// poll per entry of `polls`.
function mockQueries(polls: Mutation[][]) {
  const answers: unknown[][] = [[{ table: 'event' }], [{ now: '2026-11-18 03:00:00' }], ...polls];
  vi.mocked(clickhouseClient.query).mockImplementation(
    async () => ({ json: async () => answers.shift() ?? [] }) as never,
  );
}

const commands = () => vi.mocked(clickhouseClient.command).mock.calls.map(([params]) => params.query);

describe('clickhouseDeletion.deleteProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps waiting while ClickHouse retries a failed mutation, and succeeds once it is done', async () => {
    const failing = { table: 'event', mutation_id: 'mutation_1.txt', latest_fail_reason: 'Memory limit exceeded' };
    mockQueries([[failing], [{ ...failing, latest_fail_reason: '' }], []]);

    const done = clickhouseDeletion.deleteProjects(['1', '2'], 60_000);
    await vi.runAllTimersAsync();

    await expect(done).resolves.toBeUndefined();
    expect(commands()).toEqual(['DELETE FROM `event` WHERE projectId IN (1, 2)']);
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

    expect(commands()).toEqual([
      'DELETE FROM `event` WHERE projectId IN (1)',
      "KILL MUTATION WHERE database = currentDatabase() AND (table, mutation_id) IN (('event', 'mutation_7.txt'))",
    ]);
  });

  it('rejects ids that are not numeric before sending anything', async () => {
    mockQueries([]);
    await expect(clickhouseDeletion.deleteProjects(['1; DROP TABLE event'])).rejects.toThrow('Unexpected id');
    expect(commands()).toEqual([]);
  });
});
