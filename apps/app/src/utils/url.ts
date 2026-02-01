export function getHostname() {
  return location.hostname.split('.').slice(-2).join('.');
}

type SubDomain = 'app' | 'hub';

function getUrl(subDomain?: SubDomain) {
  const hostname = getHostname();
  const subDomainPrefix = subDomain ? `${subDomain}.` : '';
  const port = Number(location.port);
  let portSuffix = '';
  if (!isNaN(port) && port !== 80 && port !== 443 && port !== 0) {
    portSuffix = `:${port}`;
  }
  return `${location.protocol}//${subDomainPrefix}${hostname}${portSuffix}`;
}

export function getLandingPageUrl() {
  return getUrl();
}

export function getAppUrl() {
  return getUrl('app');
}

export function getBackendUrl() {
  return location.origin;
}

export function getHubUrl() {
  return getUrl('hub');
}

export function formatQueryParams(params: Record<string, any>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return '';
  const queryString = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `?${queryString}`;
}
