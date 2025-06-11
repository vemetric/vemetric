import { Vemetric } from '@vemetric/node';
import { DOMAIN } from '../consts';

if (!process.env.VEMETRIC_TOKEN) {
  throw new Error('VEMETRIC_TOKEN is required');
}

export const vemetric = new Vemetric({
  host: `https://hub.${DOMAIN}`,
  token: process.env.VEMETRIC_TOKEN,
});
