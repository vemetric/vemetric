import { EventNames } from '@vemetric/common/event';
import { HTTPException } from 'hono/http-exception';
import { describe, it, expect, vi } from 'vitest';
import type { HonoContext } from '../../src/types';
import { validateSpecialEvents } from '../../src/utils/event';

vi.mock('@vemetric/common/request-ip', () => ({
  getClientIp: vi.fn(),
}));

describe('validateSpecialEvents', () => {
  const createMockContext = (domain: string) =>
    ({
      var: {
        project: {
          domain,
        },
      },
    }) as HonoContext;

  describe('PageView event', () => {
    it('should throw error when URL is missing', () => {
      const context = createMockContext('example.com');
      const body = {
        name: EventNames.PageView,
      };

      expect(() => validateSpecialEvents(context, body)).toThrow(HTTPException);
      expect(() => validateSpecialEvents(context, body)).toThrow('Missing URL for $$pageView event');
    });

    it('should not throw error when URL is provided', () => {
      const context = createMockContext('example.com');
      const body = {
        name: EventNames.PageView,
        url: 'https://example.com/page',
      };

      expect(() => validateSpecialEvents(context, body)).not.toThrow();
    });
  });

  describe('OutboundLink event', () => {
    it('should throw error when URL is missing', () => {
      const context = createMockContext('example.com');
      const body = {
        name: EventNames.OutboundLink,
      };

      expect(() => validateSpecialEvents(context, body)).toThrow(HTTPException);
      expect(() => validateSpecialEvents(context, body)).toThrow('Missing URL for $$outboundLink event');
    });

    it('should throw error when href is missing in customData', () => {
      const context = createMockContext('example.com');
      const body = {
        name: EventNames.OutboundLink,
        url: 'https://example.com/page',
        customData: {},
      };

      expect(() => validateSpecialEvents(context, body)).toThrow(HTTPException);
      expect(() => validateSpecialEvents(context, body)).toThrow('Missing HREF for $$outboundLink event');
    });

    it('should throw error when href is not a string', () => {
      const context = createMockContext('example.com');
      const body = {
        name: EventNames.OutboundLink,
        url: 'https://example.com/page',
        customData: {
          href: 123,
        },
      };

      expect(() => validateSpecialEvents(context, body)).toThrow(HTTPException);
      expect(() => validateSpecialEvents(context, body)).toThrow('Missing HREF for $$outboundLink event');
    });

    it('should throw 200 status for internal links (same domain)', () => {
      const context = createMockContext('example.com');
      const body = {
        name: EventNames.OutboundLink,
        url: 'https://example.com/page',
        customData: {
          href: 'https://example.com/other-page',
        },
      };

      expect(() => validateSpecialEvents(context, body)).toThrow(HTTPException);
      expect(() => validateSpecialEvents(context, body)).toThrow(expect.objectContaining({ status: 200 }));
    });

    it('should throw 200 status for internal links (subdomain)', () => {
      const context = createMockContext('example.com');
      const body = {
        name: EventNames.OutboundLink,
        url: 'https://example.com/page',
        customData: {
          href: 'https://sub.example.com/page',
        },
      };

      expect(() => validateSpecialEvents(context, body)).toThrow(HTTPException);
      expect(() => validateSpecialEvents(context, body)).toThrow(expect.objectContaining({ status: 200 }));
    });

    it('should not throw error for external links', () => {
      const context = createMockContext('example.com');
      const body = {
        name: EventNames.OutboundLink,
        url: 'https://example.com/page',
        customData: {
          href: 'https://external.com/page',
        },
      };

      expect(() => validateSpecialEvents(context, body)).not.toThrow();
    });
  });

  describe('Other events', () => {
    it('should not throw error for non-special events', () => {
      const context = createMockContext('example.com');
      const body = {
        name: 'custom_event',
        url: 'https://example.com/page',
      };

      expect(() => validateSpecialEvents(context, body)).not.toThrow();
    });
  });
});
