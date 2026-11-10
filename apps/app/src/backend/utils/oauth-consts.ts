/** The OAuth scope of the MCP server's read-only tools. */
export const MCP_SCOPE = 'analytics:read';

/** Prefixes of OAuth tokens, so they're recognisable (e.g. by secret scanners) and never mistaken for API keys. */
export const OAUTH_ACCESS_TOKEN_PREFIX = 'vmat_';
export const OAUTH_REFRESH_TOKEN_PREFIX = 'vmrt_';

/** The app page of the OAuth flow where users choose what to share, see `pages/oauth/consent.tsx`. */
export const OAUTH_CONSENT_PAGE = '/oauth/consent';
