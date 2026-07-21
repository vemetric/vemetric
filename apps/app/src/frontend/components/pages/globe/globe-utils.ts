import type { GlobeViewState } from '@/utils/local-storage';
import { globeViewState } from '@/utils/local-storage';
import {
  DESKTOP_GLOBE_CONFIG,
  type GlobeConfig,
  MIN_GLOBE_THETA,
  MIN_ZOOMED_GLOBE_THETA,
  MAX_GLOBE_THETA,
  MAX_ZOOMED_GLOBE_THETA,
  DEFAULT_GLOBE_THETA,
  ZOOMED_GLOBE_THETA_BIAS,
  DEFAULT_DRAG_SENSITIVITY,
  MAX_DRAG_SENSITIVITY,
  GLOBE_ZOOM_CURSOR_PULL_FADE_START,
  GLOBE_ZOOM_CURSOR_PULL_MIN_MULTIPLIER,
  GLOBE_ZOOM_CURSOR_PULL,
  MIN_MARKER_SCALE,
  MAX_MARKER_SCALE,
  DEFAULT_GLOBE_PHI,
  DEFAULT_GLOBE_AUTO_ROTATE,
  DEFAULT_GLOBE_LOCKED,
} from './globe-consts';

export const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

export const getThetaBounds = (scale: number, globeConfig: GlobeConfig = DESKTOP_GLOBE_CONFIG) => {
  const zoomProgress = clampNumber(
    (scale - globeConfig.defaultScale) / (globeConfig.maxScale - globeConfig.defaultScale),
    0,
    1,
  );

  return {
    min: MIN_GLOBE_THETA + (MIN_ZOOMED_GLOBE_THETA - MIN_GLOBE_THETA) * zoomProgress,
    max: MAX_GLOBE_THETA + (MAX_ZOOMED_GLOBE_THETA - MAX_GLOBE_THETA) * zoomProgress,
  };
};
export const clampTheta = (
  theta: number,
  scale = DESKTOP_GLOBE_CONFIG.defaultScale,
  globeConfig = DESKTOP_GLOBE_CONFIG,
) => {
  const { min, max } = getThetaBounds(scale, globeConfig);

  return clampNumber(theta, min, max);
};
export const getPreferredTheta = (scale: number, globeConfig: GlobeConfig) => {
  const zoomProgress = clampNumber(
    (scale - globeConfig.defaultScale) / (globeConfig.maxScale - globeConfig.defaultScale),
    0,
    1,
  );

  return DEFAULT_GLOBE_THETA + ZOOMED_GLOBE_THETA_BIAS * zoomProgress;
};

export const getDragSensitivity = (scale: number, globeConfig: GlobeConfig) => {
  const zoomProgress = clampNumber(
    (scale - globeConfig.defaultScale) / (globeConfig.maxScale - globeConfig.defaultScale),
    0,
    1,
  );

  return DEFAULT_DRAG_SENSITIVITY + (MAX_DRAG_SENSITIVITY - DEFAULT_DRAG_SENSITIVITY) * zoomProgress;
};

export const getOffsetLimit = (dimension: number, scale: number, globeConfig: GlobeConfig) =>
  Math.max(0, dimension * (scale - globeConfig.offsetResetScale) * 0.5);
export const clampGlobeOffset = (
  offset: [number, number],
  rect: DOMRect,
  scale: number,
  globeConfig: GlobeConfig,
): [number, number] => [
  clampNumber(
    offset[0],
    -getOffsetLimit(rect.width, scale, globeConfig),
    getOffsetLimit(rect.width, scale, globeConfig),
  ),
  clampNumber(
    offset[1],
    -getOffsetLimit(rect.height, scale, globeConfig),
    getOffsetLimit(rect.height, scale, globeConfig),
  ),
];
export const getCursorFocusOffset = (
  rect: DOMRect,
  cursorX: number,
  cursorY: number,
  scale: number,
  globeConfig: GlobeConfig,
): [number, number] => [
  -clampNumber(cursorX / (rect.width / 2), -1, 1) * getOffsetLimit(rect.width, scale, globeConfig),
  -clampNumber(cursorY / (rect.height / 2), -1, 1) * getOffsetLimit(rect.height, scale, globeConfig),
];

export const getZoomCursorPull = (currentScale: number, nextScale: number, globeConfig: GlobeConfig) => {
  const zoomStepPull = clampNumber((nextScale - currentScale) / 0.1, 0, 1);
  const zoomProgress = clampNumber(
    (nextScale - GLOBE_ZOOM_CURSOR_PULL_FADE_START) / (globeConfig.maxScale - GLOBE_ZOOM_CURSOR_PULL_FADE_START),
    0,
    1,
  );
  const scaleMultiplier = 1 - zoomProgress * (1 - GLOBE_ZOOM_CURSOR_PULL_MIN_MULTIPLIER);

  return zoomStepPull * GLOBE_ZOOM_CURSOR_PULL * scaleMultiplier;
};

export const getMarkerScale = (scale: number, globeConfig: GlobeConfig) => {
  const zoomProgress = clampNumber(
    (scale - globeConfig.minScale) / (globeConfig.maxScale - globeConfig.minScale),
    0,
    1,
  );

  return MIN_MARKER_SCALE + (MAX_MARKER_SCALE - MIN_MARKER_SCALE) * zoomProgress;
};
export const setMarkerScale = (element: HTMLElement, scale: number, globeConfig: GlobeConfig) => {
  const markerScale = getMarkerScale(scale, globeConfig);

  element.style.setProperty('--globe-marker-scale', `${markerScale}`);
  element.style.setProperty('--globe-marker-scale-inverse', `${1 / markerScale}`);
};

export const getInitialGlobeViewState = (globeConfig: GlobeConfig): GlobeViewState => {
  const storedState = globeViewState.get();

  return {
    scale: clampNumber(storedState?.scale ?? globeConfig.defaultScale, globeConfig.minScale, globeConfig.maxScale),
    offset: storedState?.offset ?? [0, 0],
    phi: storedState?.phi ?? DEFAULT_GLOBE_PHI,
    theta: clampTheta(
      storedState?.theta ?? DEFAULT_GLOBE_THETA,
      storedState?.scale ?? globeConfig.defaultScale,
      globeConfig,
    ),
    autoRotate: storedState?.autoRotate ?? DEFAULT_GLOBE_AUTO_ROTATE,
    locked: storedState?.locked ?? DEFAULT_GLOBE_LOCKED,
  };
};

export type GlobeRotation = {
  phi: number;
  theta: number;
};
const getShortestAngleDelta = (delta: number) => Math.atan2(Math.sin(delta), Math.cos(delta));
export const getLocationRotation = (
  [latitude, longitude]: [number, number],
  scale: number,
  globeConfig: GlobeConfig,
): GlobeRotation => {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180 - Math.PI;
  const radius = Math.cos(latitudeRadians);
  const point = {
    x: -radius * Math.cos(longitudeRadians),
    y: Math.sin(latitudeRadians),
    z: radius * Math.sin(longitudeRadians),
  };
  const phi = Math.atan2(-point.x, point.z);
  const rotatedZ = -Math.sin(phi) * point.x + Math.cos(phi) * point.z;

  return {
    phi,
    theta: clampTheta(Math.atan2(point.y, rotatedZ), scale, globeConfig),
  };
};
export const getFocusedRotation = (currentRotation: GlobeRotation, targetRotation: GlobeRotation): GlobeRotation => ({
  phi: currentRotation.phi + getShortestAngleDelta(targetRotation.phi - currentRotation.phi),
  theta: targetRotation.theta,
});
export const interpolateRotation = (from: GlobeRotation, to: GlobeRotation, progress: number): GlobeRotation => ({
  phi: from.phi + (to.phi - from.phi) * progress,
  theta: from.theta + (to.theta - from.theta) * progress,
});
export const interpolateOffset = (from: [number, number], to: [number, number], progress: number): [number, number] => [
  from[0] + (to[0] - from[0]) * progress,
  from[1] + (to[1] - from[1]) * progress,
];
