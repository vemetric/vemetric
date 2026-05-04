import { EMPTY_GEO_DATA, type GeoData } from '@vemetric/common/geo';
import type { ClickhouseSession, ClickhouseUser, DeviceData } from 'clickhouse';
import { clickhouseSession } from 'clickhouse';

function fillMissingGeoData(session: ClickhouseSession, geoData: GeoData | undefined) {
  if (!geoData) {
    return session;
  }

  return {
    ...session,
    countryCode: session.countryCode || geoData.countryCode,
    city: session.city || geoData.city,
    latitude: session.latitude ?? geoData.latitude,
    longitude: session.longitude ?? geoData.longitude,
  };
}

export async function increaseClickhouseSessionDuration(session: ClickhouseSession, now: string, geoData?: GeoData) {
  const duration = Math.round((new Date(now).getTime() - new Date(session.startedAt).getTime()) / 1000);

  if (duration > session.duration) {
    await clickhouseSession.insert([
      {
        ...fillMissingGeoData(session, geoData),
        endedAt: now,
        duration,
      },
    ]);
  }
}

export async function getSessionData(
  geoData: GeoData | undefined,
  user: ClickhouseUser | null,
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
