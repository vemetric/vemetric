import { Queue, QueueEvents } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { flushSessionBuffer } from '../src/ingestion';
import { initSessionFlushWorker } from '../src/workers/session-flush-worker';

vi.mock('../src/ingestion', () => ({
  assertIngestionStateStorage: vi.fn().mockResolvedValue(undefined),
  flushSessionBuffer: vi.fn().mockResolvedValue(0),
}));

describe.skipIf(process.env.INGESTION_STATE_TESTS !== '1')('session flush scheduling against Redis', () => {
  it('runs one flush across replicas and continues after a replica closes', async () => {
    if (new URL(process.env.REDIS_URL!).port !== '16389') throw new Error('Use disposable Redis on port 16389');
    const connection = { url: process.env.REDIS_URL };
    const queue = new Queue('session-flush', { connection });
    const events = new QueueEvents('session-flush', { connection });
    const workers: Awaited<ReturnType<typeof initSessionFlushWorker>>[] = [];
    let release!: () => void;
    const gate = new Promise<number>((resolve) => {
      release = () => resolve(0);
    });
    vi.mocked(flushSessionBuffer).mockImplementationOnce(() => gate);
    try {
      await queue.obliterate({ force: true });
      await events.waitUntilReady();
      workers.push(await initSessionFlushWorker(), await initSessionFlushWorker());
      await queue.add('first', {});
      await queue.add('second', {});
      await vi.waitFor(() => expect(flushSessionBuffer).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(await queue.getGlobalConcurrency()).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(flushSessionBuffer).toHaveBeenCalledTimes(1);

      release();
      await workers[0]!.close();
      const next = await queue.add('after-replica-close', {});
      await next.waitUntilFinished(events, 5000);
      expect(vi.mocked(flushSessionBuffer).mock.calls.length).toBeGreaterThan(1);
    } finally {
      release();
      await Promise.all(workers.map((worker) => worker.close()));
      await queue.obliterate({ force: true });
      await events.close();
      await queue.close();
    }
  }, 15000);
});
