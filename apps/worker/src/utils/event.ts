import type { UrlData } from 'clickhouse';

export function ignoreEvent(urlData: UrlData) {
  if (urlData.origin === 'https://gtm-msr.appspot.com') {
    // special case for Google Tag Manager, we ignore these events
    return true;
  }

  return false;
}
