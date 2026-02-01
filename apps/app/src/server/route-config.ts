export const API_PREFIXES = ['_api', 'api'] as const;

export const NO_CACHE_PATHS = new Set<string>(['/manifest.webmanifest', '/sw.js', '/registerSW.js']);
export const NO_CACHE_PREFIXES = ['/workbox-'] as const;

export function isNoCachePath(pathname: string): boolean {
  if (NO_CACHE_PATHS.has(pathname)) {
    return true;
  }
  return NO_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function toPathPrefixRegex(prefix: string): RegExp {
  return new RegExp(`^/${escapeRegex(prefix)}(?:/|$)`);
}

export function buildDevServerExcludeRegex(): RegExp {
  const parts = API_PREFIXES.map((prefix) => escapeRegex(prefix)).join('|');
  return new RegExp(`^/(?!${parts}).*`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
