import { Vemetric } from '@vemetric/node';

if (!process.env.VEMETRIC_TOKEN || !process.env.VEMETRIC_DOMAIN) {
  throw new Error('VEMETRIC_TOKEN and VEMETRIC_DOMAIN are required');
}

export const vemetric = new Vemetric({
  host: `https://hub.${process.env.VEMETRIC_DOMAIN}`,
  token: process.env.VEMETRIC_TOKEN,
});
