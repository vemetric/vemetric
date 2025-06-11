import { describe, it, expect } from 'vitest';
import { round, roundTwoDecimal, formatNumber } from '../src/math';

describe('math utilities', () => {
  describe('round', () => {
    it('should round to 0 decimal places by default', () => {
      expect(round(3.14159)).toBe(3);
      expect(round(3.5)).toBe(4);
      expect(round(3.4)).toBe(3);
    });

    it('should round to specified decimal places', () => {
      expect(round(3.14159, 2)).toBe(3.14);
      expect(round(3.14159, 3)).toBe(3.142);
      expect(round(3.14159, 4)).toBe(3.1416);
    });

    it('should handle negative numbers', () => {
      expect(round(-3.14159, 2)).toBe(-3.14);
      expect(round(-3.6)).toBe(-4);
      expect(round(-3.4)).toBe(-3);
    });

    it('should handle zero', () => {
      expect(round(0)).toBe(0);
      expect(round(0, 2)).toBe(0);
    });
  });

  describe('roundTwoDecimal', () => {
    it('should always round to 2 decimal places', () => {
      expect(roundTwoDecimal(3.14159)).toBe(3.14);
      expect(roundTwoDecimal(3.145)).toBe(3.15);
      expect(roundTwoDecimal(3.144)).toBe(3.14);
    });

    it('should handle negative numbers', () => {
      expect(roundTwoDecimal(-3.14159)).toBe(-3.14);
      expect(roundTwoDecimal(-3.146)).toBe(-3.15);
    });

    it('should handle zero', () => {
      expect(roundTwoDecimal(0)).toBe(0);
    });
  });

  describe('formatNumber', () => {
    describe('with shorten = false', () => {
      it('should format numbers with thousands separators', () => {
        expect(formatNumber(1000)).toBe('1,000');
        expect(formatNumber(1000000)).toBe('1,000,000');
        expect(formatNumber(1234567)).toBe('1,234,567');
      });

      it('should handle decimal numbers', () => {
        expect(formatNumber(1000.5)).toBe('1,000.5');
        expect(formatNumber(1000000.75)).toBe('1,000,000.75');
      });

      it('should handle negative numbers', () => {
        expect(formatNumber(-1000)).toBe('-1,000');
        expect(formatNumber(-1000000)).toBe('-1,000,000');
      });

      it('should handle zero', () => {
        expect(formatNumber(0)).toBe('0');
      });
    });

    describe('with shorten = true', () => {
      it('should format millions with M suffix', () => {
        expect(formatNumber(1000000, true)).toBe('1M');
        expect(formatNumber(1500000, true)).toBe('1.5M');
        expect(formatNumber(1234567, true)).toBe('1.23M');
      });

      it('should format thousands with k suffix', () => {
        expect(formatNumber(1000, true)).toBe('1k');
        expect(formatNumber(1500, true)).toBe('1.5k');
        expect(formatNumber(1234, true)).toBe('1.23k');
      });

      it('should not shorten numbers less than 1000', () => {
        expect(formatNumber(999, true)).toBe('999');
        expect(formatNumber(500, true)).toBe('500');
        expect(formatNumber(0, true)).toBe('0');
      });

      it('should handle negative numbers', () => {
        expect(formatNumber(-1000000, true)).toBe('-1M');
        expect(formatNumber(-1500, true)).toBe('-1.5k');
      });
    });
  });
});
