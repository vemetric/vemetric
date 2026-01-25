export function getUserName(displayName?: string, identifier?: string) {
  return displayName || identifier || 'Anonymous';
}
