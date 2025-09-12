import '../types.d';
import type { Key } from 'siphash';
import siphash from 'siphash';

function combineTo64Bit(high: number, low: number): bigint {
  // Convert MSB to BigInt and shift left 32 bits
  const highBig = BigInt(high >>> 0) << BigInt(32);
  // Convert LSB to BigInt, using >>> 0 to ensure unsigned interpretation
  const lowBig = BigInt(low >>> 0);
  // Combine them with bitwise OR
  return highBig | lowBig;
}

export function createSiphashKey(data: string): Key {
  return siphash.string16_to_key(data);
}

export function createSiphash(key: Key, data: string) {
  const { h, l } = siphash.hash(key, data);
  return combineTo64Bit(h, l);
}
