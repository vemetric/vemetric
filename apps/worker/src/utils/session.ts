import { EMPTY_GEO_DATA, type GeoData } from '@vemetric/common/geo';
import type { DeviceData } from 'clickhouse';
import type { IngestionUser } from './user-cache';

export async function getSessionData(
  geoData: GeoData | undefined,
  user: Pick<IngestionUser, 'countryCode' | 'city' | 'latitude' | 'longitude'> | null,
  deviceData: DeviceData,
) {
  let { countryCode, city, latitude, longitude } = geoData || EMPTY_GEO_DATA;

  // TODO: this logic might has to be adjusted once we allow smartphone apps to ingest events
  if (deviceData.clientType === 'server' && user) {
    if (user.countryCode) {
      countryCode = user.countryCode;
    }
    if (user.city) {
      city = user.city;
    }
    if (user.latitude !== null) {
      latitude = user.latitude;
    }
    if (user.longitude !== null) {
      longitude = user.longitude;
    }
  }

  const sessionData = {
    countryCode,
    city,
    latitude,
    longitude,
  };

  return sessionData;
}
