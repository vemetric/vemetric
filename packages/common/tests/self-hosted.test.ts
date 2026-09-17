import { afterEach, describe, expect, it } from 'vitest';
import { assertBooleanEnvFlags, isSelfHosted, parseStrictBooleanEnv } from '../src/self-hosted';

const FLAG = 'VEMETRIC_TEST_BOOLEAN_FLAG';

describe('parseStrictBooleanEnv', () => {
  afterEach(() => {
    delete process.env[FLAG];
    delete process.env.SELF_HOSTED;
  });

  it('returns the default value when the variable is not set', () => {
    expect(parseStrictBooleanEnv(FLAG, true)).toBe(true);
    expect(parseStrictBooleanEnv(FLAG, false)).toBe(false);
  });

  it('treats an empty value like an unset variable', () => {
    process.env[FLAG] = '   ';

    expect(parseStrictBooleanEnv(FLAG, true)).toBe(true);
  });

  it('accepts true and false regardless of casing and padding', () => {
    process.env[FLAG] = ' TRUE ';
    expect(parseStrictBooleanEnv(FLAG, false)).toBe(true);

    process.env[FLAG] = 'False';
    expect(parseStrictBooleanEnv(FLAG, true)).toBe(false);
  });

  it.each(['1', '0', 'yes', 'no', 'fasle', 'on'])('rejects the unrecognised value %s', (value) => {
    process.env[FLAG] = value;

    expect(() => parseStrictBooleanEnv(FLAG, true)).toThrowError(new RegExp(FLAG));
  });

  it('does not leak the offending value in the error message', () => {
    process.env[FLAG] = 'super-secret';

    let message = '';
    try {
      parseStrictBooleanEnv(FLAG, false);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toBe('');
    expect(message).not.toContain('super-secret');
  });

  it('validates every requested flag eagerly', () => {
    process.env[FLAG] = 'nope';

    expect(() => assertBooleanEnvFlags(['SELF_HOSTED', FLAG])).toThrowError(new RegExp(FLAG));
    expect(() => assertBooleanEnvFlags(['SELF_HOSTED'])).not.toThrow();
  });

  it('keeps the hosted deployment on the hosted path when SELF_HOSTED is unset', () => {
    expect(isSelfHosted()).toBe(false);

    process.env.SELF_HOSTED = 'true';
    expect(isSelfHosted()).toBe(true);
  });
});
