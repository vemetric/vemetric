import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  createProjectDeletionToken,
  verifyProjectDeletionToken,
} from '../src/email-token';

describe('email-token', () => {
  const originalEnv = process.env.EMAIL_TOKEN_SECRET;

  beforeAll(() => {
    process.env.EMAIL_TOKEN_SECRET = 'test-secret';
  });

  afterAll(() => {
    if (originalEnv) process.env.EMAIL_TOKEN_SECRET = originalEnv;
    else delete process.env.EMAIL_TOKEN_SECRET;
  });

  describe('unsubscribe tokens', () => {
    it('creates and verifies a token', () => {
      const userId = 'user-123';
      const token = createUnsubscribeToken(userId);
      expect(verifyUnsubscribeToken(token)).toBe(userId);
    });

    it('creates different tokens for different users', () => {
      expect(createUnsubscribeToken('user-1')).not.toBe(createUnsubscribeToken('user-2'));
    });

    it('rejects tampered hash', () => {
      const token = createUnsubscribeToken('user-123');
      const [userId] = token.split('.');
      expect(verifyUnsubscribeToken(`${userId}.tampered`)).toBeNull();
    });

    it('rejects tampered userId', () => {
      const token = createUnsubscribeToken('user-123');
      const [, hash] = token.split('.');
      expect(verifyUnsubscribeToken(`user-456.${hash}`)).toBeNull();
    });

    it('rejects invalid tokens', () => {
      expect(verifyUnsubscribeToken('')).toBeNull();
      expect(verifyUnsubscribeToken('no-separator')).toBeNull();
      expect(verifyUnsubscribeToken('invalid.token')).toBeNull();
    });
  });

  describe('project deletion tokens', () => {
    it('creates and verifies a token', () => {
      const projectId = 'project-123';
      const userId = 'user-456';
      const token = createProjectDeletionToken(projectId, userId);
      const payload = verifyProjectDeletionToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.projectId).toBe(projectId);
      expect(payload?.userId).toBe(userId);
      expect(payload?.exp).toBeGreaterThan(Date.now());
    });

    it('creates different tokens for different projects', () => {
      const userId = 'user-123';
      expect(createProjectDeletionToken('project-1', userId)).not.toBe(
        createProjectDeletionToken('project-2', userId),
      );
    });

    it('creates different tokens for different users', () => {
      const projectId = 'project-123';
      expect(createProjectDeletionToken(projectId, 'user-1')).not.toBe(
        createProjectDeletionToken(projectId, 'user-2'),
      );
    });

    it('rejects tampered projectId', () => {
      const token = createProjectDeletionToken('project-123', 'user-456');
      const [, userId, exp, hash] = token.split('.');
      expect(verifyProjectDeletionToken(`tampered.${userId}.${exp}.${hash}`)).toBeNull();
    });

    it('rejects tampered userId', () => {
      const token = createProjectDeletionToken('project-123', 'user-456');
      const [projectId, , exp, hash] = token.split('.');
      expect(verifyProjectDeletionToken(`${projectId}.tampered.${exp}.${hash}`)).toBeNull();
    });

    it('rejects tampered expiry', () => {
      const token = createProjectDeletionToken('project-123', 'user-456');
      const [projectId, userId, , hash] = token.split('.');
      const newExp = Date.now() + 9999999999;
      expect(verifyProjectDeletionToken(`${projectId}.${userId}.${newExp}.${hash}`)).toBeNull();
    });

    it('rejects expired tokens', () => {
      vi.useFakeTimers();
      const token = createProjectDeletionToken('project-123', 'user-456');

      // Advance time by 2 hours (past the 1 hour expiry)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);

      expect(verifyProjectDeletionToken(token)).toBeNull();
      vi.useRealTimers();
    });

    it('accepts valid tokens before expiry', () => {
      vi.useFakeTimers();
      const token = createProjectDeletionToken('project-123', 'user-456');

      // Advance time by 30 minutes (within the 1 hour expiry)
      vi.advanceTimersByTime(30 * 60 * 1000);

      const payload = verifyProjectDeletionToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.projectId).toBe('project-123');
      vi.useRealTimers();
    });

    it('rejects invalid tokens', () => {
      expect(verifyProjectDeletionToken('')).toBeNull();
      expect(verifyProjectDeletionToken('no-separator')).toBeNull();
      expect(verifyProjectDeletionToken('only.two.parts')).toBeNull();
      expect(verifyProjectDeletionToken('a.b.c.d')).toBeNull();
    });
  });
});
