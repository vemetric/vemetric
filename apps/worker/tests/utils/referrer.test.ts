import { dbProject } from 'database';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReferrerFromRequest } from '../../src/utils/referrer';

vi.mock('../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('database', () => ({
  dbProject: {
    findById: vi.fn(),
  },
}));

vi.mock('../../src/consts/referrers', () => ({
  referrers: {
    'google.com': { name: 'Google', type: 'search' },
    'facebook.com': { name: 'Facebook', type: 'social' },
    'twitter.com': { name: 'Twitter', type: 'social' },
    'linkedin.com': { name: 'LinkedIn', type: 'social' },
    'youtube.com': { name: 'YouTube', type: 'video' },
    'github.com': { name: 'GitHub', type: 'social' },
    'stackoverflow.com': { name: 'Stack Overflow', type: 'social' },
    'chatgpt.com': { name: 'ChatGPT', type: 'llm' },
  },
}));

describe('getReferrerFromRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract referrer from v-referrer header', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {
      'v-referrer': 'https://google.com/search',
    };

    const result = await getReferrerFromRequest(BigInt(123), headers);

    expect(result).toEqual({
      referrer: 'Google',
      referrerUrl: 'https://google.com/search',
      referrerType: 'search',
    });
    expect(dbProject.findById).toHaveBeenCalledWith('123');
  });

  it('should extract ref parameter from URL', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {
      'v-referrer': 'https://google.com/search',
    };
    const url = 'https://example.com/page?ref=newsletter';

    const result = await getReferrerFromRequest(BigInt(123), headers, url);

    expect(result).toEqual({
      referrer: 'newsletter',
      referrerUrl: 'https://google.com/search',
      referrerType: 'unknown',
    });
  });

  it('should extract via parameter from URL', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {
      'v-referrer': 'https://facebook.com',
    };
    const url = 'https://example.com/page?via=social-media';

    const result = await getReferrerFromRequest(BigInt(123), headers, url);

    expect(result).toEqual({
      referrer: 'social-media',
      referrerUrl: 'https://facebook.com',
      referrerType: 'unknown',
    });
  });

  it('should extract utm_source parameter from URL', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {
      'v-referrer': 'https://twitter.com',
    };
    const url = 'https://example.com/page?utm_source=twitter-campaign';

    const result = await getReferrerFromRequest(BigInt(123), headers, url);

    expect(result).toEqual({
      referrer: 'twitter-campaign',
      referrerUrl: 'https://twitter.com',
      referrerType: 'unknown',
    });
  });

  it('should extract source parameter from URL', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {
      'v-referrer': 'https://linkedin.com',
    };
    const url = 'https://example.com/page?source=linkedin-post';

    const result = await getReferrerFromRequest(BigInt(123), headers, url);

    expect(result).toEqual({
      referrer: 'linkedin-post',
      referrerUrl: 'https://linkedin.com',
      referrerType: 'unknown',
    });
  });

  it('should handle invalid URL gracefully', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {
      'v-referrer': 'https://google.com',
    };
    const url = 'not-a-valid-url?ref=123';

    const result = await getReferrerFromRequest(BigInt(123), headers, url);

    expect(result).toEqual({
      referrer: 'Google',
      referrerUrl: 'https://google.com',
      referrerType: 'search',
    });
  });

  it('should handle missing v-referrer header', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {};
    const url = 'https://example.com/page?ref=parameter';

    const result = await getReferrerFromRequest(BigInt(123), headers, url);

    expect(result).toEqual({
      referrer: 'parameter',
      referrerUrl: '',
      referrerType: 'unknown',
    });
  });

  it('should handle known Referrer with missing v-referrer header', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {};
    const url = 'https://example.com/page?utm_source=chatgpt.com';

    const result = await getReferrerFromRequest(BigInt(123), headers, url);

    expect(result).toEqual({
      referrer: 'ChatGPT',
      referrerUrl: '',
      referrerType: 'llm',
    });
  });

  it('should handle project not found', async () => {
    vi.mocked(dbProject.findById).mockResolvedValueOnce(null);

    const headers = {
      'v-referrer': 'https://google.com',
    };

    const result = await getReferrerFromRequest(BigInt(123), headers);

    expect(result).toEqual({
      referrer: 'Google',
      referrerUrl: 'https://google.com',
      referrerType: 'search',
    });
  });

  it('should handle empty headers and no URL', async () => {
    const projectMock = { domain: 'example.com' };
    vi.mocked(dbProject.findById).mockResolvedValueOnce(projectMock as any);

    const headers = {};

    const result = await getReferrerFromRequest(BigInt(123), headers);

    expect(result).toBeUndefined();
  });
});
