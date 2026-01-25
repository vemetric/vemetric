import { getVemetricUrl } from '@vemetric/common/env';
import { Vemetric } from '@vemetric/node';

// Make token optional in development
const token = process.env.VEMETRIC_TOKEN;

export const vemetric = token
  ? new Vemetric({
      host: `${getVemetricUrl('hub')}`,
      token,
    })
  : {
      // No-op implementation for development without token
      trackEvent: async () => {},
      identify: async () => {},
    };
