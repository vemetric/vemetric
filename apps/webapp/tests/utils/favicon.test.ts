import { describe, it, expect } from 'vitest';
import { getFaviconUrl } from '../../src/utils/favicon';

describe('getFaviconUrl', () => {
  it('should handle URLs with https protocol', () => {
    const url = 'https://example.com';
    const expected =
      'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=https://example.com';
    expect(getFaviconUrl(url)).toBe(expected);
  });

  it('should handle URLs with http protocol', () => {
    const url = 'http://example.com';
    const expected =
      'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=https://example.com';
    expect(getFaviconUrl(url)).toBe(expected);
  });

  it('should add https protocol to URLs without protocol', () => {
    const url = 'example.com';
    const expected =
      'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=https://example.com';
    expect(getFaviconUrl(url)).toBe(expected);
  });

  it('should handle URLs with subdomains', () => {
    const url = 'https://sub.example.com';
    const expected =
      'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=https://sub.example.com';
    expect(getFaviconUrl(url)).toBe(expected);
  });

  it('should handle invalid URLs gracefully', () => {
    const url = 'not-a-url';
    const expected =
      'https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=https://not-a-url';
    expect(getFaviconUrl(url)).toBe(expected);
  });
});
