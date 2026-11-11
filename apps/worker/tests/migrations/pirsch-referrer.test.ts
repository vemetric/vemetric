import { describe, expect, it } from 'vitest';
import { resolvePirschReferrer } from '../../src/migrations/pirsch-referrer';

describe('resolvePirschReferrer', () => {
  it('maps an empty referrer to none, whatever the channel', () => {
    expect(resolvePirschReferrer({ channel: 'Direct' }, 'example.com')).toEqual({
      referrer: '',
      referrerUrl: '',
      referrerType: 'none',
    });
  });

  it('uses the referrer list for Pirsch "Direct" rows that have a referrer', () => {
    expect(
      resolvePirschReferrer({ channel: 'Direct', referrer_name: 'Google', referrer: 'https://www.google.com/' }),
    ).toEqual({ referrer: 'Google', referrerUrl: 'https://www.google.com/', referrerType: 'search' });
    expect(
      resolvePirschReferrer({ channel: 'Direct', referrer_name: 'Twitter', referrer: 'https://t.co/abc' }),
    ).toEqual({
      referrer: 'X',
      referrerUrl: 'https://t.co/abc',
      referrerType: 'social',
    });
    expect(
      resolvePirschReferrer({
        channel: 'Direct',
        referrer_name: 'Gmail',
        referrer: 'android-app://com.google.android.gm/',
      }),
    ).toMatchObject({ referrer: 'Gmail', referrerType: 'email' });
  });

  it('takes the list name for listed hosts', () => {
    expect(
      resolvePirschReferrer({ channel: 'Direct', referrer_name: 'l.threads.com', referrer: 'https://l.threads.com/' }),
    ).toMatchObject({ referrer: 'Threads', referrerType: 'social' });
  });

  it('falls back to the channel for hosts that are not listed', () => {
    expect(
      resolvePirschReferrer({ channel: 'AI', referrer_name: 'x', referrer: 'https://some-ai.example/' }),
    ).toMatchObject({ referrer: 'x', referrerType: 'llm' });
    expect(
      resolvePirschReferrer({ channel: 'Referral', referrer_name: 'shipped.club', referrer: 'https://shipped.club/' }),
    ).toMatchObject({ referrer: 'shipped.club', referrerType: 'unknown' });
    expect(
      resolvePirschReferrer({ channel: 'Direct', referrer_name: 'shipped.club', referrer: 'https://shipped.club/' }),
    ).toMatchObject({ referrerType: 'unknown' });
  });

  it('looks up a referrer name without URL in the list (param values)', () => {
    expect(resolvePirschReferrer({ channel: 'Organic Social', referrer_name: 'threads' })).toEqual({
      referrer: 'Threads',
      referrerUrl: '',
      referrerType: 'social',
    });
  });

  it('types the own domain as internal', () => {
    expect(
      resolvePirschReferrer(
        { channel: 'Referral', referrer_name: 'example.com', referrer: 'https://www.example.com/' },
        'example.com',
      ),
    ).toEqual({ referrer: '', referrerUrl: 'https://www.example.com/', referrerType: 'internal' });
  });
});
