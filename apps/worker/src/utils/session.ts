import type { ClickhouseSession, ClickhouseUser, DeviceData } from 'clickhouse';
import { clickhouseSession } from 'clickhouse';
import { getGeoData } from './geo';

export async function increaseClickhouseSessionDuration(session: ClickhouseSession, now: string) {
  const duration = Math.round((new Date(now).getTime() - new Date(session.startedAt).getTime()) / 1000);
  if (duration > session.duration) {
    await clickhouseSession.insert([
      {
        ...session,
        endedAt: now,
        duration,
      },
    ]);
  }
}

export async function getSessionData(ipAddress: string, user: ClickhouseUser | null, deviceData: DeviceData) {
  let { countryCode, city, latitude, longitude } = await getGeoData(ipAddress);

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
