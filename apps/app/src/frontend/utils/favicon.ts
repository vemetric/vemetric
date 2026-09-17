import { IS_SELF_HOSTED } from './self-hosted';

/**
 * Resolves the favicon of a domain through Vemetric's favicon service.
 *
 * Self hosted instances return no URL: sending every referrer hostname of their visitors to a
 * third party service would defeat the point of self hosting. Consumers fall back to a generic
 * icon when there is no URL.
 */
export const getFaviconUrl = (url: string, size = 64) => {
  if (IS_SELF_HOSTED) {
    return undefined;
  }

  let hostname = url;

  try {
    const urlObj = new URL(url);
    hostname = urlObj.hostname;
  } catch {
    // empty
  }

  return `https://favicon.vemetric.com/${hostname}?size=${size}`;
};
