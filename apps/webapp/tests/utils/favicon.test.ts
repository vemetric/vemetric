import { describe, it, expect } from 'vitest';
import { getFaviconUrl } from '../../src/utils/favicon';

describe('getFaviconUrl', () => {
  it('should handle URLs with https protocol', () => {
    const url = 'https://example.com';
    const expected = 'https://favicon.vemetric.com/example.com?size=64';
    expect(getFaviconUrl(url)).toBe(expected);
  });

  it('should handle URLs with http protocol', () => {
    const url = 'http://example.com';
    const expected = 'https://favicon.vemetric.com/example.com?size=64';
    expect(getFaviconUrl(url)).toBe(expected);
  });

  it('should add https protocol to URLs without protocol', () => {
    const url = 'example.com';
    const expected = 'https://favicon.vemetric.com/example.com?size=64';
    expect(getFaviconUrl(url)).toBe(expected);
  });

  it('should handle URLs with subdomains', () => {
    const url = 'https://sub.example.com';
    const expected = 'https://favicon.vemetric.com/sub.example.com?size=64';
    expect(getFaviconUrl(url)).toBe(expected);
  });

  it('should handle invalid URLs gracefully', () => {
    const url = 'not-a-url';
    const expected = 'https://favicon.vemetric.com/not-a-url?size=64';
    expect(getFaviconUrl(url)).toBe(expected);
  });
});
