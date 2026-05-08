import type { COBEOptions } from 'cobe';
import { EARTH_RADIUS_KM, USER_BUCKET_DISTANCE_KM } from './globe-consts';

export interface MockGlobeUser {
  id: string;
  name: string;
  avatarUrl?: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
}

export const MOCK_GLOBE_USERS: MockGlobeUser[] = [
  {
    id: 'usr_1',
    name: 'Mia',
    country: 'United States',
    city: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
  },
  { id: 'usr_2', name: 'Noah', country: 'United States', city: 'Oakland', lat: 37.8044, lng: -122.2712 },
  {
    id: 'usr_3',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/143.jpg?size=64&seed=e6bab1bc2e6612899186283a68f21a6f',
    name: 'Ava',
    country: 'United States',
    city: 'San Jose',
    lat: 37.3382,
    lng: -121.8863,
  },
  {
    id: 'usr_4',
    name: 'Leo',
    country: 'United States',
    city: 'New York',
    lat: 40.7128,
    lng: -74.006,
  },
  {
    id: 'usr_5',
    name: 'Ivy',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/68.jpg?size=64&seed=6de76f4f4d6319c242d2eee94c98da01',
    country: 'United States',
    city: 'Brooklyn',
    lat: 40.6782,
    lng: -73.9442,
  },
  {
    id: 'usr_6',
    name: 'Lina',
    country: 'United Kingdom',
    city: 'London',
    lat: 51.5074,
    lng: -0.1278,
  },
  { id: 'usr_7', name: 'Oskar', country: 'Germany', city: 'Berlin', lat: 52.52, lng: 13.405 },
  {
    id: 'usr_8',
    name: 'Amelie',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/137.jpg?size=64&seed=a8edcae2402a2ec41575ecdad1af68f2',
    country: 'France',
    city: 'Paris',
    lat: 48.8566,
    lng: 2.3522,
  },
  { id: 'usr_9', name: 'Sofia', country: 'Brazil', city: 'Sao Paulo', lat: -23.5558, lng: -46.6396 },
  {
    id: 'usr_10',
    name: 'Kenji',
    country: 'Japan',
    city: 'Tokyo',
    lat: 35.6762,
    lng: 139.6503,
  },
  {
    id: 'usr_11',
    name: 'Yuki',
    avatarUrl: 'https://mockmind-api.uifaces.co/content/human/92.jpg?size=64&seed=a4d627dc9eb82121f90e605353c7b183',
    country: 'Japan',
    city: 'Yokohama',
    lat: 35.4437,
    lng: 139.638,
  },
  { id: 'usr_12', name: 'Nora', country: 'Australia', city: 'Sydney', lat: -33.8688, lng: 151.2093 },
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
