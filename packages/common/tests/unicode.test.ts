import { describe, expect, it } from 'vitest';
import { toWellFormed, toWellFormedDeep } from '../src/unicode';

describe('toWellFormed', () => {
  it('replaces lone high and low surrogates', () => {
    expect(toWellFormed('X\ud800')).toBe('X�');
    expect(toWellFormed('\udc00Y')).toBe('�Y');
    expect(toWellFormed('a\ud800b\udc00c')).toBe('a�b�c');
  });

  it('keeps valid surrogate pairs and plain text unchanged', () => {
    expect(toWellFormed('ok 😀 Ünïcödé')).toBe('ok 😀 Ünïcödé');
    expect(toWellFormed('')).toBe('');
  });

  it('produces JSON without lone surrogate escapes', () => {
    expect(JSON.stringify(toWellFormed('X\ud800'))).toBe('"X�"');
  });
});

describe('toWellFormedDeep', () => {
  it('normalizes nested strings and keys without changing other values', () => {
    const input = { a: 'X\ud800', n: 1, b: null, nested: { ['k\udc00']: ['ok', '\ud83d'] }, flag: true };
    expect(toWellFormedDeep(input)).toEqual({
      a: 'X�',
      n: 1,
      b: null,
      nested: { ['k�']: ['ok', '�'] },
      flag: true,
    });
    expect(input.a).toBe('X\ud800');
  });
});
