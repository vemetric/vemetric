import { describe, expect, it } from 'vitest';
import { getDeviceHeadersFingerprint } from '../../src/utils/headers';

describe('getDeviceHeadersFingerprint', () => {
  const userAgent = 'Mozilla/5.0 (Linux; Android 10; K) Chrome/128.0.0.0 Mobile Safari/537.36';

  it('ignores headers that device detection does not read, and header order and case', () => {
    expect(
      getDeviceHeadersFingerprint({ 'user-agent': userAgent, 'sec-ch-ua-model': '"Pixel 8"', 'v-referrer': 'a' }),
    ).toBe(getDeviceHeadersFingerprint({ 'Sec-CH-UA-Model': '"Pixel 8"', 'User-Agent': userAgent, referer: 'b' }));
  });

  it('distinguishes user agents and client hints', () => {
    const base = getDeviceHeadersFingerprint({ 'user-agent': userAgent });
    expect(getDeviceHeadersFingerprint({ 'user-agent': `${userAgent} Other` })).not.toBe(base);
    expect(getDeviceHeadersFingerprint({ 'user-agent': userAgent, 'sec-ch-ua-model': '"Pixel 8"' })).not.toBe(base);
  });
});
