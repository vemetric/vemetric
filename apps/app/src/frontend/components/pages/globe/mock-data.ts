import type { COBEOptions } from 'cobe';
import { EARTH_RADIUS_KM, USER_BUCKET_DISTANCE_KM } from './globe-consts';

export interface MockGlobeUser {
  id: string;
  name: string;
  avatarUrl?: string;
  country: string;
  city: string;
  lastSeenAt: string;
  lat: number;
  lng: number;
}

export const MOCK_GLOBE_USERS: MockGlobeUser[] = [
  {
    id: 'usr_1',
    name: 'Mia',
    country: 'US',
    city: 'San Francisco',
    lastSeenAt: '2026-05-18T07:42:00',
    lat: 37.7749,
    lng: -122.4194,
  },
  {
    id: 'usr_2',
    name: 'Noah',
    country: 'US',
    city: 'Oakland',
    lastSeenAt: '2026-05-18T07:36:00',
    lat: 37.8044,
    lng: -122.2712,
  },
  {
    id: 'usr_3',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/143.jpg?size=64&seed=e6bab1bc2e6612899186283a68f21a6f',
    name: 'Ava',
    country: 'US',
    city: 'San Jose',
    lastSeenAt: '2026-05-18T07:18:00',
    lat: 37.3382,
    lng: -121.8863,
  },
  {
    id: 'usr_13',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/120.jpg?size=64&seed=7f409965904eb4f4d96ac84fb56ac67e',
    name: 'Ethan',
    country: 'US',
    city: 'Palo Alto',
    lastSeenAt: '2026-05-18T06:58:00',
    lat: 37.4419,
    lng: -122.143,
  },
  {
    id: 'usr_14',
    name: 'Grace',
    country: 'US',
    city: 'Fremont',
    lastSeenAt: '2026-05-18T06:41:00',
    lat: 37.5485,
    lng: -121.9886,
  },
  {
    id: 'usr_4',
    name: 'Leo',
    country: 'US',
    city: 'New York',
    lastSeenAt: '2026-05-18T07:12:00',
    lat: 40.7128,
    lng: -74.006,
  },
  {
    id: 'usr_5',
    name: 'Ivy',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/68.jpg?size=64&seed=6de76f4f4d6319c242d2eee94c98da01',
    country: 'US',
    city: 'Brooklyn',
    lastSeenAt: '2026-05-18T06:34:00',
    lat: 40.6782,
    lng: -73.9442,
  },
  {
    id: 'usr_15',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/52.jpg?size=64&seed=5b42e31ea98ec3b6c6ca1f8e2d2848bb',
    name: 'Maya',
    country: 'US',
    city: 'Queens',
    lastSeenAt: '2026-05-18T05:55:00',
    lat: 40.7282,
    lng: -73.7949,
  },
  {
    id: 'usr_6',
    name: 'Lina',
    country: 'GB',
    city: 'London',
    lastSeenAt: '2026-05-18T07:05:00',
    lat: 51.5074,
    lng: -0.1278,
  },
  {
    id: 'usr_17',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/85.jpg?size=64&seed=996a8040b4f87fc4c95c36e8e51bdb26',
    name: 'Freya',
    country: 'GB',
    city: 'Croydon',
    lastSeenAt: '2026-05-18T06:23:00',
    lat: 51.3762,
    lng: -0.0982,
  },
  {
    id: 'usr_18',
    name: 'Arthur',
    country: 'GB',
    city: 'Watford',
    lastSeenAt: '2026-05-18T05:48:00',
    lat: 51.6565,
    lng: -0.3903,
  },
  {
    id: 'usr_19',
    name: 'Ruby',
    country: 'GB',
    city: 'Reading',
    lastSeenAt: '2026-05-18T05:21:00',
    lat: 51.4543,
    lng: -0.9781,
  },
  {
    id: 'usr_7',
    name: 'Oskar',
    country: 'DE',
    city: 'Berlin',
    lastSeenAt: '2026-05-18T06:16:00',
    lat: 52.52,
    lng: 13.405,
  },
  {
    id: 'usr_8',
    name: 'Amelie',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/137.jpg?size=64&seed=a8edcae2402a2ec41575ecdad1af68f2',
    country: 'FR',
    city: 'Paris',
    lastSeenAt: '2026-05-18T05:39:00',
    lat: 48.8566,
    lng: 2.3522,
  },
  {
    id: 'usr_9',
    name: 'Sofia',
    country: 'BR',
    city: 'Sao Paulo',
    lastSeenAt: '2026-05-18T04:52:00',
    lat: -23.5558,
    lng: -46.6396,
  },
  {
    id: 'usr_10',
    name: 'Kenji',
    country: 'JP',
    city: 'Tokyo',
    lastSeenAt: '2026-05-18T07:31:00',
    lat: 35.6762,
    lng: 139.6503,
  },
  {
    id: 'usr_11',
    name: 'Yuki',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/92.jpg?size=64&seed=a4d627dc9eb82121f90e605353c7b183',
    country: 'JP',
    city: 'Yokohama',
    lastSeenAt: '2026-05-18T06:49:00',
    lat: 35.4437,
    lng: 139.638,
  },
  {
    id: 'usr_20',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/110.jpg?size=64&seed=60ec25c8e091a9e136d45c0fa6954125',
    name: 'Hana',
    country: 'JP',
    city: 'Kawasaki',
    lastSeenAt: '2026-05-18T06:07:00',
    lat: 35.5308,
    lng: 139.7029,
  },
  {
    id: 'usr_21',
    name: 'Ren',
    country: 'JP',
    city: 'Chiba',
    lastSeenAt: '2026-05-18T05:33:00',
    lat: 35.6074,
    lng: 140.1065,
  },
  {
    id: 'usr_12',
    name: 'Nora',
    country: 'AU',
    city: 'Sydney',
    lastSeenAt: '2026-05-18T04:18:00',
    lat: -33.8688,
    lng: 151.2093,
  },
];

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

function getUsersCenter(users: MockGlobeUser[]): [number, number] {
  const center = users.reduce(
    (acc, user) => {
      acc.lat += user.lat;
      acc.lng += user.lng;
      return acc;
    },
    { lat: 0, lng: 0 },
  );

  return [center.lat / users.length, center.lng / users.length];
}

function getGlobeUserBuckets(users: MockGlobeUser[]) {
  const buckets: GlobeUserBucket[] = [];

  for (const user of users) {
    const userLocation: [number, number] = [user.lat, user.lng];
    const nearbyBucket = buckets.find(
      (candidate) => getDistanceKm(candidate.location, userLocation) <= USER_BUCKET_DISTANCE_KM,
    );

    if (nearbyBucket) {
      nearbyBucket.users.push(user);
      nearbyBucket.location = getUsersCenter(nearbyBucket.users);
      continue;
    }

    buckets.push({
      id: user.id,
      location: userLocation,
      country: user.country,
      city: user.city,
      users: [user],
    });
  }

  return buckets;
}

interface GlobeUserBucket {
  id: string;
  location: [number, number];
  country: string;
  city: string;
  users: MockGlobeUser[];
}

type GlobeMarker = NonNullable<COBEOptions['markers']>[number];
function getGlobeMarkersFromBuckets(buckets: GlobeUserBucket[]): GlobeMarker[] {
  return buckets.map((bucket) => {
    return {
      location: bucket.location,
      size: 0,
      id: bucket.id,
    };
  });
}

export const MOCK_GLOBE_USER_BUCKETS = getGlobeUserBuckets(MOCK_GLOBE_USERS);
export const MOCK_GLOBE_MARKERS = getGlobeMarkersFromBuckets(MOCK_GLOBE_USER_BUCKETS);
