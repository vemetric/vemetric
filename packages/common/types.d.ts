declare module 'siphash' {
  export type Key = [number, number, number, number];

  export function string16_to_key(str: string): Key;
  export function hash(key: Key, str: string): { h: number; l: number };
}
