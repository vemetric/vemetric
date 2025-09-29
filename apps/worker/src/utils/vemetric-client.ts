import { getVemetricUrl } from '@vemetric/common/env';
import { Vemetric } from '@vemetric/node';

if (!process.env.VEMETRIC_TOKEN) {
  throw new Error('VEMETRIC_TOKEN is required');
}

export const vemetric = new Vemetric({
  host: getVemetricUrl('hub'),
  token: process.env.VEMETRIC_TOKEN,
});
