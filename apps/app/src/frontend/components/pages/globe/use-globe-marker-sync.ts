import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGlobeStore } from '@/stores/globe-store';
import type { GlobeUserBucket } from '@/utils/trpc';

const DEPTH_WEIGHT = 1_000_000;
const SCREEN_Y_WEIGHT = 50_000;
const Z_INDEX_OFFSET = 1_000_000;
const ROTATION_SYNC_EPSILON = 0.0001;
const GLOBE_RADIUS = 0.8;
export const COBE_DEVICE_PIXEL_RATIO = 2;

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
  point: MarkerPoint,
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

type MarkerPoint = ReturnType<typeof getMarkerPoint>;

const projectMarkerPoint = (
  point: MarkerPoint,
  rotationValues: {
    sinPhi: number;
    cosPhi: number;
    sinTheta: number;
    cosTheta: number;
  },
  viewport: {
    width: number;
    height: number;
    canvasWidth: number;
    canvasHeight: number;
  },
  scale: number,
  offset: [number, number],
) => {
  const { sinPhi, cosPhi, sinTheta, cosTheta } = rotationValues;
  const x = point.x * GLOBE_RADIUS;
  const y = point.y * GLOBE_RADIUS;
  const z = point.z * GLOBE_RADIUS;
  const projectedX = cosPhi * x + sinPhi * z;
  const projectedY = sinPhi * sinTheta * x + cosTheta * y - cosPhi * sinTheta * z;
  const projectedDepth = -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z;
  const aspectRatio = viewport.canvasWidth / viewport.canvasHeight;
  const normalizedX =
    (projectedX / aspectRatio) * scale + (offset[0] * scale * COBE_DEVICE_PIXEL_RATIO) / viewport.canvasWidth;
  const normalizedY = -projectedY * scale + (offset[1] * scale * COBE_DEVICE_PIXEL_RATIO) / viewport.canvasHeight;

  return {
    x: ((normalizedX + 1) / 2) * viewport.width,
    y: ((normalizedY + 1) / 2) * viewport.height,
    visible: projectedDepth >= 0 || projectedX * projectedX + projectedY * projectedY >= GLOBE_RADIUS * GLOBE_RADIUS,
  };
};

interface Props {
  buckets: GlobeUserBucket[];
}

export function useGlobeMarkerSync({ buckets }: Props) {
  const {
    refs: { globeRootRef, offsetRef, rotationRef, scaleRef },
  } = useGlobeStore();
  const markerElementsRef = useRef(new Map<string, HTMLDivElement>());
  const markerElementsVersionRef = useRef(0);
  const markerPoints = useMemo(
    () =>
      buckets.map((bucket) => ({
        id: bucket.id,
        point: getMarkerPoint(bucket.location),
      })),
    [buckets],
  );

  const setMarkerElement = useCallback((id: string, element: HTMLDivElement | null) => {
    const currentElement = markerElementsRef.current.get(id);

    if (currentElement === element) {
      return;
    }

    if (element) {
      element.style.display = 'none';
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';
      element.style.transform = 'translate(-9999px, -9999px)';
      markerElementsRef.current.set(id, element);
      markerElementsVersionRef.current += 1;
      return;
    }

    markerElementsRef.current.delete(id);
    markerElementsVersionRef.current += 1;
  }, []);

  useEffect(() => {
    let frameId: number;
    let lastSyncedState: {
      phi: number;
      theta: number;
      scale: number;
      offsetX: number;
      offsetY: number;
      width: number;
      height: number;
      markerElementsVersion: number;
    } | null = null;

    const syncMarkers = () => {
      const globeRoot = globeRootRef.current;
      const { width, height } = globeRoot?.getBoundingClientRect() ?? {};
      const canvas = globeRoot?.querySelector('canvas');
      const viewport =
        globeRoot && canvas instanceof HTMLCanvasElement && width && height
          ? {
              width,
              height,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
            }
          : null;
      const rotation = rotationRef.current;
      const scale = scaleRef.current;
      const offset = offsetRef.current;
      const markerElementsVersion = markerElementsVersionRef.current;
      const shouldSync =
        viewport !== null &&
        (lastSyncedState === null ||
          Math.abs(rotation.phi - lastSyncedState.phi) > ROTATION_SYNC_EPSILON ||
          Math.abs(rotation.theta - lastSyncedState.theta) > ROTATION_SYNC_EPSILON ||
          scale !== lastSyncedState.scale ||
          offset[0] !== lastSyncedState.offsetX ||
          offset[1] !== lastSyncedState.offsetY ||
          viewport.width !== lastSyncedState.width ||
          viewport.height !== lastSyncedState.height ||
          markerElementsVersion !== lastSyncedState.markerElementsVersion);

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

          const position = projectMarkerPoint(point, rotationValues, viewport, scale, offset);
          const zIndex = String(getMarkerZIndex(point, rotationValues));

          const transform = `translate(${position.x}px, ${position.y}px)`;
          const display = position.visible ? '' : 'none';
          const opacity = position.visible ? '1' : '0';
          const pointerEvents = position.visible ? '' : 'none';

          if (element.style.transform !== transform) {
            element.style.transform = transform;
          }

          if (element.style.display !== display) {
            element.style.display = display;
          }

          if (element.style.opacity !== opacity) {
            element.style.opacity = opacity;
          }

          if (element.style.pointerEvents !== pointerEvents) {
            element.style.pointerEvents = pointerEvents;
          }

          if (element.style.zIndex !== zIndex) {
            element.style.zIndex = zIndex;
          }
        });

        lastSyncedState = {
          phi: rotation.phi,
          theta: rotation.theta,
          scale,
          offsetX: offset[0],
          offsetY: offset[1],
          width: viewport.width,
          height: viewport.height,
          markerElementsVersion,
        };
      }

      frameId = requestAnimationFrame(syncMarkers);
    };

    syncMarkers();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [globeRootRef, markerPoints, offsetRef, rotationRef, scaleRef]);

  return {
    setMarkerElement,
  };
}
