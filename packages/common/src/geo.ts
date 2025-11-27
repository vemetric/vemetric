import type { GeoData } from 'clickhouse';
import type { Logger } from 'pino';

interface GeoDataResponse {
  country: string;
  stateprov: string;
  stateprovCode: string;
  city: string;
  latitude: string;
  longitude: string;
  timezone: string;
  continent: string;
  accuracyRadius: number;
  asn: number;
  asnOrganization: string;
  asnNetwork: string;
}

export const EMPTY_GEO_DATA: GeoData = {
  countryCode: '',
  city: '',
  latitude: null,
  longitude: null,
};

export async function getGeoDataFromIp(ipAddress: string, logger: Logger, timeout = 2000): Promise<GeoData> {
  if (!process.env.GEO_API) {
    return EMPTY_GEO_DATA;
  }

  try {
    const result = (await fetch(`${process.env.GEO_API}/${ipAddress}`, { signal: AbortSignal.timeout(timeout) }).then(
      (res) => res.json(),
    )) as GeoDataResponse | null;

    if (!result) {
      logger.info({ ipAddress }, 'No geo data found for ip address');
      return EMPTY_GEO_DATA;
    }

    const convertedLatitude = Number(result.latitude);
    const convertedLongitude = Number(result.longitude);

    return {
      countryCode: result.country,
      city: result.city,
      latitude: isNaN(convertedLatitude) ? null : convertedLatitude,
      longitude: isNaN(convertedLongitude) ? null : convertedLongitude,
    };
  } catch (err) {
    logger.error({ err }, 'Error getting geo data');
    return EMPTY_GEO_DATA;
  }
}
