interface GeoApiResponse {
  country?: string;
  countryCode?: string;
  [key: string]: unknown;
}

export async function getCountryFromIP(ipAddress: string): Promise<string | null> {
  if (!process.env.GEO_API || !ipAddress) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);

    try {
      const response = await fetch(`${process.env.GEO_API}/${ipAddress}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const result = (await response.json()) as GeoApiResponse | null;

      if (!result) {
        return null;
      }

      const countryCode = result.countryCode || result.country;

      if (!countryCode || typeof countryCode !== 'string') {
        return null;
      }

      return countryCode.toUpperCase().substring(0, 2);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return null;
  }
}
