import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../src/utils/logger';
import { getUrlParams } from '../../src/utils/url';

vi.mock('../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('getUrlParams', () => {
  it('should return default params for undefined URL', () => {
    const result = getUrlParams(undefined);
    expect(result).toEqual({});
  });

  it('should parse a basic URL correctly', () => {
    const result = getUrlParams('https://example.com/path?key=value');
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/path',
      urlHash: '',
      queryParams: { key: 'value' },
    });
  });

  it('should remove trailing slash from pathname', () => {
    const result = getUrlParams('https://example.com/path/');
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/path',
      urlHash: '',
      queryParams: {},
    });
  });

  it('should keep root path slash', () => {
    const result = getUrlParams('https://example.com/');
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/',
      urlHash: '',
      queryParams: {},
    });
  });

  it('should convert http to https', () => {
    const result = getUrlParams('http://example.com/path');
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/path',
      urlHash: '',
      queryParams: {},
    });
  });

  it('should remove www from origin', () => {
    const result = getUrlParams('https://www.example.com/path');
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/path',
      urlHash: '',
      queryParams: {},
    });
  });

  it('should extract UTM parameters', () => {
    const result = getUrlParams(
      'https://example.com/path?utm_source=test&utm_medium=email&utm_campaign=spring&utm_content=banner&utm_term=keyword',
    );
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/path',
      urlHash: '',
      queryParams: {
        utm_source: 'test',
        utm_medium: 'email',
        utm_campaign: 'spring',
        utm_content: 'banner',
        utm_term: 'keyword',
      },
      utmSource: 'test',
      utmMedium: 'email',
      utmCampaign: 'spring',
      utmContent: 'banner',
      utmTerm: 'keyword',
    });
  });

  it('should handle URL with hash', () => {
    const result = getUrlParams('https://example.com/path#section');
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/path',
      urlHash: '#section',
      queryParams: {},
    });
  });

  it('should handle invalid URL', () => {
    const result = getUrlParams('not-a-valid-url');
    expect(result).toEqual({});
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle URL with multiple query parameters', () => {
    const result = getUrlParams('https://example.com/path?param1=value1&param2=value2&param3=value3#hash');
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/path',
      urlHash: '#hash',
      queryParams: {
        param1: 'value1',
        param2: 'value2',
        param3: 'value3',
      },
    });
  });

  it('should handle URL with encoded parameters', () => {
    const result = getUrlParams('https://example.com/path?search=hello%20world&utm_source=test%20campaign');
    expect(result).toEqual({
      origin: 'https://example.com',
      pathname: '/path',
      urlHash: '',
      queryParams: {
        search: 'hello world',
        utm_source: 'test campaign',
      },
      utmSource: 'test campaign',
    });
  });
});
