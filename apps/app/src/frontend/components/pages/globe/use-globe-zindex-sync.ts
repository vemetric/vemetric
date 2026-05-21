import { useCallback, useEffect, useRef } from 'react';
import type { GlobeUserBucket } from '@/utils/trpc';

const DEPTH_WEIGHT = 1_000_000;
const SCREEN_Y_WEIGHT = 50_000;
const Z_INDEX_OFFSET = 1_000_000;

const getMarkerZIndex = ([latitude, longitude]: [number, number], rotation: { phi: number; theta: number }) => {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180 - Math.PI;
  const radius = Math.cos(latitudeRadians);
  const point = {
    x: -radius * Math.cos(longitudeRadians),
    y: Math.sin(latitudeRadians),
    z: radius * Math.sin(longitudeRadians),
  };
  const sinPhi = Math.sin(rotation.phi);
  const cosPhi = Math.cos(rotation.phi);
  const sinTheta = Math.sin(rotation.theta);
  const cosTheta = Math.cos(rotation.theta);
  const projectedY =
    sinPhi * sinTheta * point.x +
    cosTheta * point.y -
    cosPhi * sinTheta * point.z;
  const projectedDepth = -sinPhi * cosTheta * point.x + sinTheta * point.y + cosPhi * cosTheta * point.z;

  return Math.round((projectedDepth + 1) * DEPTH_WEIGHT + (1 - projectedY) * SCREEN_Y_WEIGHT + longitude + Z_INDEX_OFFSET);
};

interface Props {
  buckets: GlobeUserBucket[];
  rotationRef: React.RefObject<{ phi: number; theta: number }>;
}

export function useGlobeZIndexSync({ buckets, rotationRef }: Props) {
  const markerElementsRef = useRef(new Map<string, HTMLDivElement>());

  const setMarkerElement = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      markerElementsRef.current.set(id, element);
      return;
    }

    markerElementsRef.current.delete(id);
  }, []);

  useEffect(() => {
    let frameId: number;

    const syncMarkerZIndexes = () => {
      buckets.forEach((bucket) => {
        const element = markerElementsRef.current.get(bucket.id);
        if (!element) return;

        const zIndex = String(getMarkerZIndex(bucket.location, rotationRef.current));
        if (element.style.zIndex !== zIndex) {
          element.style.zIndex = zIndex;
        }
      });

      frameId = requestAnimationFrame(syncMarkerZIndexes);
    };

    syncMarkerZIndexes();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [buckets, rotationRef]);

  return {
    setMarkerElement,
  };
}
