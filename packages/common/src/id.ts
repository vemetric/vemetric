import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const customId16 = customAlphabet(alphabet, 16);
export const customId21 = customAlphabet(alphabet, 21);

export function generateEventId() {
  return customId21();
}
