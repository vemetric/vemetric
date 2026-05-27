import type { clickhouseEvent } from 'clickhouse';

const USER_BUCKET_DISTANCE_KM = 700;
const EARTH_RADIUS_KM = 6371;

type GlobeUser = Awaited<ReturnType<typeof clickhouseEvent.queryGlobeUsers>>[number];
type LocatedGlobeUser = GlobeUser & {
  latitude: number;
  longitude: number;
};

interface GlobeUserBucket {
  id: string;
  location: [number, number];
  userCount: number;
  users: LocatedGlobeUser[];
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function getDistanceKm(from: [number, number], to: [number, number]) {
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const latDelta = toRadians(toLat - fromLat);
  const lngDelta = toRadians(toLng - fromLng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(lngDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getUsersCenter(users: LocatedGlobeUser[]): [number, number] {
  const center = users.reduce(
    (acc, user) => {
      acc.latitude += user.latitude;
      acc.longitude += user.longitude;
      return acc;
    },
    { latitude: 0, longitude: 0 },
  );

  return [center.latitude / users.length, center.longitude / users.length];
}

export function getGlobeUserBuckets(users: LocatedGlobeUser[]) {
  const buckets: GlobeUserBucket[] = [];

  for (const user of users) {
    const userLocation: [number, number] = [user.latitude, user.longitude];
    const nearbyBucket = buckets.find(
      (candidate) => getDistanceKm(candidate.location, userLocation) <= USER_BUCKET_DISTANCE_KM,
    );

    if (nearbyBucket) {
      nearbyBucket.userCount += 1;
      nearbyBucket.users.push(user);
      nearbyBucket.location = getUsersCenter(nearbyBucket.users);
      continue;
    }

    buckets.push({
      id: String(user.id),
      location: userLocation,
      userCount: 1,
      users: [user],
    });
  }

  return buckets;
}
