import { getVemetricUrl } from '@vemetric/common/env';
import { isSelfHosted } from '@vemetric/common/self-hosted';
import { Vemetric } from '@vemetric/node';

const token = process.env.VEMETRIC_TOKEN?.trim();

if (!token && !isSelfHosted()) {
  throw new Error('VEMETRIC_TOKEN is required');
}

/**
 * Client for Vemetric's own product analytics.
 *
 * Self hosted instances do not necessarily report into a Vemetric project, so on those the
 * client is only instantiated when a token is configured. Without one, tracking calls resolve
 * without sending anything. On the hosted instance the token is required, as before.
 */
export const vemetric: Pick<Vemetric, 'trackEvent'> = token
  ? new Vemetric({
      host: getVemetricUrl('hub'),
      token,
    })
  : {
      trackEvent: async () => {},
    };
