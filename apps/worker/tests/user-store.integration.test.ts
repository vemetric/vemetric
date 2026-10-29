import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserQueue } from '@vemetric/queues/update-user-queue';
import type { Worker } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clickhouseClient } from '../../../packages/clickhouse/src/client';
import { clickhouseUser } from '../../../packages/clickhouse/src/models/user';
import { closeStateRedis, stateRedis } from '../src/ingestion/redis';
import { flushUserBuffer, getUser, upsertUser } from '../src/ingestion/user-buffer';
import { userKeyPrefix } from '../src/ingestion/user-redis-commands';
import { type UserCreate } from '../src/ingestion/user-state';
import { pendingUserTtl, userKey, userStore } from '../src/ingestion/user-store';
import { findIngestionUser } from '../src/utils/user-cache';
import { initUpdateUserWorker } from '../src/workers/update-user-worker';

const projectId = BigInt('18446744073709551000');
const userId = BigInt('18446744073709551002');
const dirtyKey = `${userKeyPrefix}dirty`;
const at = (seconds: number) =>
  new Date(Date.UTC(2026, 9, 5, 10, 0, seconds)).toISOString().replace('T', ' ').replace('Z', '');
const create = (seconds: number, data: Record<string, unknown> = {}): UserCreate => ({
  createdAt: at(seconds),
  identifier: 'alice',
  displayName: 'Alice',
  avatarUrl: '',
  data,
  geo: { countryCode: 'AT', city: 'Vienna', latitude: 48, longitude: 16 },
  firstPageView: {},
});
const set = (seconds: number, data: Record<string, unknown>) =>
  upsertUser(projectId, userId, { type: 'update', update: { updatedAt: at(seconds), data: { set: data } } });

describe.skipIf(process.env.INGESTION_STATE_TESTS !== '1')('user writes against Redis and ClickHouse', () => {
  beforeAll(() => {
    if (
      !process.env.CLICKHOUSE_DB?.startsWith('vm_concurrency_test_') ||
      new URL(process.env.REDIS_URL!).port !== '16389'
    ) {
      throw new Error('Use an isolated vm_concurrency_test_* database and Redis on port 16389');
    }
  });
  beforeEach(async () => {
    vi.restoreAllMocks();
    await stateRedis().flushdb();
    await clickhouseClient.command({ query: 'TRUNCATE TABLE user' });
  });
  afterAll(async () => {
    await closeStateRedis();
    await clickhouseClient.close();
  });

  it('keeps every change of concurrent updates and writes the full row once flushed', async () => {
    await upsertUser(projectId, userId, { type: 'create', create: create(0, { plan: 'free' }) });
    await Promise.all(Array.from({ length: 40 }, (_, i) => set(1 + (i % 50), { [`key${i}`]: i })));
    expect(await clickhouseUser.findById(projectId, userId)).toBeNull();

    await flushUserBuffer();
    const row = await clickhouseUser.findById(projectId, userId);
    expect(Object.keys(row!.customData)).toHaveLength(41);
    expect(row).toMatchObject({ identifier: 'alice', displayName: 'Alice', countryCode: 'AT' });
    expect(await stateRedis().zcard(dirtyKey)).toBe(0);
  });

  it('applies updates processed concurrently by several worker replicas', async () => {
    const workers: Worker[] = [];
    try {
      await upsertUser(projectId, userId, { type: 'create', create: create(0) });
      for (let i = 0; i < 3; i++) workers.push(await initUpdateUserWorker());
      await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          addToQueue(updateUserQueue, {
            projectId: String(projectId),
            userId: String(userId),
            updatedAt: at(1 + i),
            data: { set: { [`key${i}`]: i } },
          }),
        ),
      );
      await vi.waitFor(
        async () => expect(Object.keys((await getUser(projectId, userId))!.customData)).toHaveLength(30),
        { timeout: 15_000, interval: 100 },
      );
    } finally {
      await Promise.all(workers.map((worker) => worker.close()));
      await updateUserQueue.obliterate({ force: true });
    }
  });

  it('applies an update that ran before the create', async () => {
    await set(5, { company: 'Acme' });
    expect(await getUser(projectId, userId)).toBeNull();
    const ttl = await stateRedis().ttl(userKey(projectId, userId));
    expect(ttl).toBeGreaterThan(pendingUserTtl - 10);
    expect(await stateRedis().zcard(dirtyKey)).toBe(0);

    await upsertUser(projectId, userId, { type: 'create', create: create(0, { plan: 'free' }) });
    await flushUserBuffer();
    expect((await clickhouseUser.findById(projectId, userId))!.customData).toEqual({ plan: 'free', company: 'Acme' });
  });

  it('writes the newest row last when a stale flush lands after a newer one', async () => {
    await upsertUser(projectId, userId, { type: 'create', create: create(0, { plan: 'free' }) });
    const stale = await userStore.readPending(10);
    await set(5, { plan: 'pro' });
    await flushUserBuffer();

    // A stalled flusher writes its older snapshot after the newer one, then fails to acknowledge it.
    await clickhouseUser.insert([
      { ...(await clickhouseUser.findById(projectId, userId))!, customData: { plan: 'free' }, updatedAt: at(0) },
    ]);
    await userStore.acknowledgeFlush(stale);
    expect(await stateRedis().zcard(dirtyKey)).toBe(1);
    expect(await stateRedis().ttl(userKey(projectId, userId))).toBe(-1);

    await flushUserBuffer();
    await clickhouseClient.command({ query: 'OPTIMIZE TABLE user FINAL' });
    expect((await clickhouseUser.findById(projectId, userId))!.customData).toEqual({ plan: 'pro' });
  });

  it('continues from the ClickHouse row after the Redis state expired', async () => {
    await upsertUser(projectId, userId, { type: 'create', create: create(0, { plan: 'free' }) });
    await flushUserBuffer();
    await stateRedis().del(userKey(projectId, userId));

    await set(5, { seats: 3 });
    // An older change than the persisted row is ignored for fields that already have a value.
    await set(-5, { plan: 'trial' });
    await flushUserBuffer();
    expect((await clickhouseUser.findById(projectId, userId))!.customData).toEqual({ plan: 'free', seats: 3 });
  });

  it('shows changes to ingestion before they are flushed', async () => {
    expect(await findIngestionUser(projectId, userId)).toBeNull();
    await upsertUser(projectId, userId, { type: 'create', create: create(0) });
    expect(await findIngestionUser(projectId, userId)).toMatchObject({ identifier: 'alice', displayName: 'Alice' });
    await upsertUser(projectId, userId, { type: 'update', update: { updatedAt: at(5), displayName: 'Alice A.' } });
    expect(await findIngestionUser(projectId, userId)).toMatchObject({ displayName: 'Alice A.' });
  });

  it('does not create or flush a user for updates of an anonymous id', async () => {
    await set(5, { plan: 'pro' });
    expect(await flushUserBuffer()).toBe(0);
    expect(await findIngestionUser(projectId, userId)).toBeNull();
  });
});
