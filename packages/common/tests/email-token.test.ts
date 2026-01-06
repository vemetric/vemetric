import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createUnsubscribeToken, verifyUnsubscribeToken } from '../src/email-token';

describe('email-token', () => {
  const originalEnv = process.env.EMAIL_TOKEN_SECRET;

  beforeAll(() => {
    process.env.EMAIL_TOKEN_SECRET = 'test-secret';
  });

  afterAll(() => {
    if (originalEnv) process.env.EMAIL_TOKEN_SECRET = originalEnv;
    else delete process.env.EMAIL_TOKEN_SECRET;
  });

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
