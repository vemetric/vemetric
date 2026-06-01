import type { COBEOptions } from 'cobe';

export interface GlobeConfig {
  minScale: number;
  maxScale: number;
  defaultScale: number;
  offsetResetScale: number;
  mapSamples: number;
}

export const DESKTOP_GLOBE_CONFIG: GlobeConfig = {
  minScale: 0.3,
  maxScale: 2.5,
  defaultScale: 1.1,
  offsetResetScale: 0.65,
  mapSamples: 30000,
};

export const MOBILE_GLOBE_CONFIG: GlobeConfig = {
  minScale: 0.4,
  maxScale: 1.8,
  defaultScale: 0.6,
  offsetResetScale: 0.55,
  mapSamples: 12000,
};

export const DEFAULT_GLOBE_PHI = 4.8;

export const DEFAULT_GLOBE_THETA = 0.15;
export const MIN_GLOBE_THETA = -0.3;
export const MAX_GLOBE_THETA = 0.5;
export const MIN_ZOOMED_GLOBE_THETA = -1;
export const MAX_ZOOMED_GLOBE_THETA = 1;
export const ZOOMED_GLOBE_THETA_BIAS = 0.8;
export const ZOOM_IN_THETA_PULL = 0.035;
export const ZOOM_OUT_THETA_PULL = 0.01;

export const DEFAULT_GLOBE_AUTO_ROTATE = true;
export const ROTATION_SPEED = 0.001;

export const DEFAULT_GLOBE_LOCKED = false;

export const GLOBE_ZOOM_SPEED = 0.001;
export const GLOBE_ZOOM_CURSOR_PULL = 0.22;
export const GLOBE_ZOOM_CURSOR_PULL_FADE_START = 1.4;
export const GLOBE_ZOOM_CURSOR_PULL_MIN_MULTIPLIER = 0.25;

export const DEFAULT_DRAG_SENSITIVITY = 200;
export const MAX_DRAG_SENSITIVITY = 520;

export const MIN_MARKER_SCALE = 0.75;
export const MAX_MARKER_SCALE = 2;

export const GLOBE_RESET_DURATION = 450;

type GlobeThemeOptions = Pick<
  COBEOptions,
  'dark' | 'diffuse' | 'mapBrightness' | 'mapBaseBrightness' | 'baseColor' | 'markerColor' | 'glowColor'
>;

export const GLOBE_THEME_OPTIONS: Record<'light' | 'dark', GlobeThemeOptions> = {
  light: {
    dark: 0,
    diffuse: 1.5,
    mapBrightness: 10,
    mapBaseBrightness: 0.01,
    baseColor: [1, 0.98, 1],
    markerColor: [0.8, 0.4, 1],
    glowColor: [0.94, 0.9, 0.94],
  },
  dark: {
    dark: 0,
    diffuse: 1,
    mapBrightness: 10,
    mapBaseBrightness: 0.005,
    baseColor: [0.4, 0.38, 0.4],
    markerColor: [0.8, 0.55, 1],
    glowColor: [0.13, 0.13, 0.13],
  },
};
