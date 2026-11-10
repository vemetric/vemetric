export function getDevProxyPort(): number {
  const port = Number(process.env.VEMETRIC_DEV_PROXY_PORT);
  return isNaN(port) ? 4050 : port;
}

export function getDevProxyPortExtension(): string {
  const port = getDevProxyPort();
  return port === 80 ? '' : `:${port}`;
}

export function getBaseDomain(): string {
  return process.env.DOMAIN || `vemetric.localhost${getDevProxyPortExtension()}`;
}

type SubDomain = 'app' | 'backend' | 'hub';

export function getVemetricUrl(subDomain?: SubDomain): string {
  const baseDomain = getBaseDomain();
  const protocol = baseDomain.includes('localhost') ? 'http' : 'https';
  const subDomainPrefix = subDomain ? `${subDomain}.` : '';
  return `${protocol}://${subDomainPrefix}${baseDomain}`;
}

/**
 * The MCP server's URL. OAuth access tokens are bound to it, so there's exactly one per deployment: `MCP_URL` for a
 * dedicated host (e.g. `https://mcp.vemetric.com/mcp`), otherwise `/mcp` on the app.
 */
export function getMcpUrl(): string {
  return process.env.MCP_URL || `${getVemetricUrl('app')}/mcp`;
}
