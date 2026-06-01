import type { ClickhouseGlobeBucket } from 'clickhouse';

const VISUAL_BUCKET_DISTANCE_KM = 400;
const EARTH_RADIUS_KM = 6371;
const VISUAL_BUCKET_PREVIEW_USERS = 3;

type VisualGlobeBucket = ClickhouseGlobeBucket & {
  bucketIds: string[];
};

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

function getVisualBucketLocation(buckets: ClickhouseGlobeBucket[]): [number, number] {
  const center = buckets.reduce(
    (acc, bucket) => {
      acc.latitude += bucket.location[0] * bucket.userCount;
      acc.longitude += bucket.location[1] * bucket.userCount;
      acc.userCount += bucket.userCount;

      return acc;
    },
    { latitude: 0, longitude: 0, userCount: 0 },
  );
  const weightedCenter: [number, number] = [center.latitude / center.userCount, center.longitude / center.userCount];

  return buckets.reduce((closestBucket, bucket) => {
    const closestDistance = getDistanceKm(closestBucket.location, weightedCenter);
    const bucketDistance = getDistanceKm(bucket.location, weightedCenter);

    return bucketDistance < closestDistance ? bucket : closestBucket;
  }).location;
}

function getVisualBucketId(bucketIds: string[]) {
  return `h3-${[...bucketIds].sort().join('-')}`;
}

export function getVisualGlobeBuckets(buckets: ClickhouseGlobeBucket[]) {
  const visualBuckets: Array<VisualGlobeBucket & { sourceBuckets: ClickhouseGlobeBucket[] }> = [];

  for (const bucket of buckets) {
    const nearbyBucket = visualBuckets.find(
      (candidate) => getDistanceKm(candidate.location, bucket.location) <= VISUAL_BUCKET_DISTANCE_KM,
    );

    if (nearbyBucket) {
      nearbyBucket.bucketIds.push(bucket.id);
      nearbyBucket.sourceBuckets.push(bucket);
      nearbyBucket.userCount += bucket.userCount;
      nearbyBucket.location = getVisualBucketLocation(nearbyBucket.sourceBuckets);
      nearbyBucket.id = getVisualBucketId(nearbyBucket.bucketIds);
      nearbyBucket.users = [...nearbyBucket.users, ...bucket.users].sort((a, b) =>
        b.lastSeenAt.localeCompare(a.lastSeenAt),
      );
      nearbyBucket.users = nearbyBucket.users.slice(0, VISUAL_BUCKET_PREVIEW_USERS);
      continue;
    }

    visualBuckets.push({
      ...bucket,
      bucketIds: [bucket.id],
      sourceBuckets: [bucket],
    });
  }

  return visualBuckets.map(({ sourceBuckets: _, ...bucket }) => bucket);
}
