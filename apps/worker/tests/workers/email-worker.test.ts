import type { EmailDripQueueProps } from '@vemetric/queues/email-drip-queue';
import type * as BullMQ from 'bullmq';
import { prismaClient } from 'database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processNoEventsSequence } from '../../src/email-sequences/project-sequences';
import { processNoProjectSequence } from '../../src/email-sequences/user-sequences';
import { initEmailWorker } from '../../src/workers/email-worker';

const captured = vi.hoisted(() => ({
  run: undefined as undefined | ((job: Pick<BullMQ.Job<EmailDripQueueProps>, 'data'>) => Promise<void>),
}));
vi.mock('bullmq', async (importOriginal) => ({
  ...(await importOriginal<typeof BullMQ>()),
  Worker: class {
    constructor(_name: string, processor: NonNullable<typeof captured.run>) {
      captured.run = processor;
    }
  },
}));
vi.mock('@vemetric/queues/email-drip-queue', () => ({ emailDripQueue: { name: 'email-drip', opts: {} } }));
vi.mock('@vemetric/queues/queue-utils', () => ({ addToQueue: vi.fn() }));
vi.mock('@vemetric/common/email-token', () => ({ createUnsubscribeToken: () => 'token' }));
vi.mock('@vemetric/common/env', () => ({ getVemetricUrl: () => 'https://app.vemetric.test' }));
vi.mock('database', () => ({
  prismaClient: {
    emailDripSequence: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    emailDripHistory: { create: vi.fn() },
    project: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
  dbEmailDripSequence: { completeUserSequence: vi.fn(), completeProjectSequence: vi.fn() },
}));
vi.mock('../../src/email-sequences/project-sequences', () => ({ processNoEventsSequence: vi.fn() }));
vi.mock('../../src/email-sequences/user-sequences', () => ({
  processNoProjectSequence: vi.fn(),
  processFirstEventFeedbackSequence: vi.fn(),
}));
vi.mock('../../src/utils/telemetry', () => ({ queueTelemetry: undefined }));

const foreignKeyError = Object.assign(new Error('Foreign key constraint violated: email_drip_sequence_projectId_fkey'), {
  code: 'P2003',
});

describe('email drip worker', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(prismaClient.emailDripSequence.findUnique).mockResolvedValue(null);
    await initEmailWorker();
  });

  it('skips a new sequence quietly when the project was deleted before it started', async () => {
    vi.mocked(prismaClient.project.findUnique).mockResolvedValue(null);

    await expect(
      captured.run!({ data: { projectId: '1', sequenceType: 'NO_EVENTS', stepNumber: 0 } }),
    ).resolves.toBeUndefined();

    expect(prismaClient.emailDripSequence.create).not.toHaveBeenCalled();
    expect(prismaClient.emailDripSequence.upsert).not.toHaveBeenCalled();
    expect(processNoEventsSequence).not.toHaveBeenCalled();
  });

  it('skips a new sequence quietly when the user was deleted before it started', async () => {
    vi.mocked(prismaClient.user.findUnique).mockResolvedValue(null);

    await expect(
      captured.run!({ data: { userId: '2', sequenceType: 'NO_PROJECT', stepNumber: 0 } }),
    ).resolves.toBeUndefined();

    expect(prismaClient.emailDripSequence.create).not.toHaveBeenCalled();
    expect(prismaClient.emailDripSequence.upsert).not.toHaveBeenCalled();
    expect(processNoProjectSequence).not.toHaveBeenCalled();
  });

  it('reports the original error without marking a sequence whose project is gone', async () => {
    // the project still exists when the sequence starts, but is deleted before the row is created
    vi.mocked(prismaClient.project.findUnique).mockResolvedValueOnce({ id: '1' } as never).mockResolvedValue(null);
    vi.mocked(prismaClient.emailDripSequence.create).mockRejectedValue(foreignKeyError);

    await expect(captured.run!({ data: { projectId: '1', sequenceType: 'NO_EVENTS', stepNumber: 0 } })).rejects.toBe(
      foreignKeyError,
    );

    expect(prismaClient.emailDripSequence.upsert).not.toHaveBeenCalled();
  });

  it('still marks the sequence as failed when the project exists', async () => {
    const error = new Error('Postmark is down');
    vi.mocked(prismaClient.project.findUnique).mockResolvedValue({ id: '1' } as never);
    vi.mocked(prismaClient.emailDripSequence.create).mockRejectedValue(error);

    await expect(captured.run!({ data: { projectId: '1', sequenceType: 'NO_EVENTS', stepNumber: 0 } })).rejects.toBe(
      error,
    );

    expect(prismaClient.emailDripSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { status: 'ERROR' } }),
    );
  });
});
