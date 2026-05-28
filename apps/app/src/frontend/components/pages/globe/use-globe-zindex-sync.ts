import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GlobeUserBucket } from '@/utils/trpc';

const DEPTH_WEIGHT = 1_000_000;
const SCREEN_Y_WEIGHT = 50_000;
const Z_INDEX_OFFSET = 1_000_000;
const ROTATION_SYNC_EPSILON = 0.0001;

const getMarkerPoint = ([latitude, longitude]: [number, number]) => {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180 - Math.PI;
  const radius = Math.cos(latitudeRadians);

  return {
    x: -radius * Math.cos(longitudeRadians),
    y: Math.sin(latitudeRadians),
    z: radius * Math.sin(longitudeRadians),
    longitude,
  };
};

const getMarkerZIndex = (
  point: ReturnType<typeof getMarkerPoint>,
  rotationValues: {
    sinPhi: number;
    cosPhi: number;
    sinTheta: number;
    cosTheta: number;
  },
) => {
  const { sinPhi, cosPhi, sinTheta, cosTheta } = rotationValues;
  const projectedY = sinPhi * sinTheta * point.x + cosTheta * point.y - cosPhi * sinTheta * point.z;
  const projectedDepth = -sinPhi * cosTheta * point.x + sinTheta * point.y + cosPhi * cosTheta * point.z;

  return Math.round(
    (projectedDepth + 1) * DEPTH_WEIGHT + (1 - projectedY) * SCREEN_Y_WEIGHT + point.longitude + Z_INDEX_OFFSET,
  );
};

interface Props {
  buckets: GlobeUserBucket[];
  rotationRef: RefObject<{ phi: number; theta: number }>;
}

export function useGlobeZIndexSync({ buckets, rotationRef }: Props) {
  const markerElementsRef = useRef(new Map<string, HTMLDivElement>());
  const markerPoints = useMemo(
    () =>
      buckets.map((bucket) => ({
        id: bucket.id,
        point: getMarkerPoint(bucket.location),
      })),
    [buckets],
  );

  const setMarkerElement = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      markerElementsRef.current.set(id, element);
      return;
    }

    markerElementsRef.current.delete(id);
  }, []);

  useEffect(() => {
    let frameId: number;
    let lastSyncedRotation: { phi: number; theta: number } | null = null;

    const syncMarkerZIndexes = () => {
      const rotation = rotationRef.current;
      const shouldSync =
        lastSyncedRotation === null ||
        Math.abs(rotation.phi - lastSyncedRotation.phi) > ROTATION_SYNC_EPSILON ||
        Math.abs(rotation.theta - lastSyncedRotation.theta) > ROTATION_SYNC_EPSILON;

      if (shouldSync) {
        const rotationValues = {
          sinPhi: Math.sin(rotation.phi),
          cosPhi: Math.cos(rotation.phi),
          sinTheta: Math.sin(rotation.theta),
          cosTheta: Math.cos(rotation.theta),
        };

        markerPoints.forEach(({ id, point }) => {
          const element = markerElementsRef.current.get(id);
          if (!element) return;

          const zIndex = String(getMarkerZIndex(point, rotationValues));
          if (element.style.zIndex !== zIndex) {
            element.style.zIndex = zIndex;
          }
        });

        lastSyncedRotation = { ...rotation };
      }

      frameId = requestAnimationFrame(syncMarkerZIndexes);
    };

    syncMarkerZIndexes();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [markerPoints, rotationRef]);

  return {
    setMarkerElement,
  };
}
