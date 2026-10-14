import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithStaleSocketRetry } from '../src/client';

const connectionReset = () =>
  Object.assign(new TypeError('The socket connection was closed unexpectedly'), { code: 'ECONNRESET' });

describe('fetchWithStaleSocketRetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries a request once when the socket was already closed', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(connectionReset()).mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithStaleSocketRetry('http://clickhouse.test/', { method: 'POST', body: '{}' });

    expect(await response.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
  });

  it('gives up after a second connection reset', async () => {
    const fetchMock = vi.fn().mockRejectedValue(connectionReset());
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithStaleSocketRetry('http://clickhouse.test/')).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors or aborted requests', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchWithStaleSocketRetry('http://clickhouse.test/')).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const abortController = new AbortController();
    abortController.abort();
    const abortedFetchMock = vi.fn().mockRejectedValue(connectionReset());
    vi.stubGlobal('fetch', abortedFetchMock);
    await expect(
      fetchWithStaleSocketRetry('http://clickhouse.test/', { signal: abortController.signal }),
    ).rejects.toMatchObject({ code: 'ECONNRESET' });
    expect(abortedFetchMock).toHaveBeenCalledTimes(1);
  });
});
