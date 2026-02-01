export const API_PREFIXES = ['trpc', 'auth', 'api', 'takeapaddle', 'metrics', 'email', 'up'] as const;

export const STATIC_EXACT_PATHS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/sw.js',
  '/registerSW.js',
] as const;
export const STATIC_PREFIXES = ['/assets/', '/workbox-'] as const;
export const STATIC_EXTENSIONS_REGEX = /\.(css|js|map|png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|eot)$/i;

export const NO_CACHE_PATHS = new Set<string>(['/manifest.webmanifest', '/sw.js', '/registerSW.js']);
export const NO_CACHE_PREFIXES = ['/workbox-'] as const;

export function isStaticAssetPath(pathname: string): boolean {
  if (STATIC_EXACT_PATHS.includes(pathname as (typeof STATIC_EXACT_PATHS)[number])) {
    return true;
  }
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  return STATIC_EXTENSIONS_REGEX.test(pathname);
}

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
