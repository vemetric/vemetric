export function getNormalizedDomain(url: string) {
  try {
    const resolvedUrl = new URL(url);
    let normalizedDomain = resolvedUrl.hostname;
    if (normalizedDomain.startsWith('www.')) {
      normalizedDomain = normalizedDomain.slice(4);
    }
    return normalizedDomain;
  } catch {
    return '';
  }
}
