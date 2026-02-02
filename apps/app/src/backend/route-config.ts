export const API_PREFIXES = ['_api', 'api'] as const;

export const NO_CACHE_PATHS = new Set<string>(['/manifest.webmanifest', '/sw.js', '/registerSW.js']);

export function isNoCachePath(pathname: string): boolean {
  return NO_CACHE_PATHS.has(pathname);
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
