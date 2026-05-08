import { z } from 'zod';

const REDIRECT_PATH_KEY = 'redirectPath';
const COUNTRIES_MAP_VIEW_STATE_KEY = 'countries-map:view-state';
const COUNTRIES_MAP_LOCKED_KEY = 'countries-map:locked';
const GLOBE_VIEW_STATE_KEY = 'globe:view-state';

export const redirectPath = {
  set: (path: string) => {
    localStorage.setItem(REDIRECT_PATH_KEY, path);
  },

  get: (): string | null => {
    return localStorage.getItem(REDIRECT_PATH_KEY);
  },

  clear: () => {
    localStorage.removeItem(REDIRECT_PATH_KEY);
  },
};

const countriesMapViewStateSchema = z.object({
  center: z.tuple([z.number().finite(), z.number().finite()]),
  zoom: z.number().finite(),
});
export type CountriesMapViewState = z.infer<typeof countriesMapViewStateSchema>;

export const countriesMapViewState = {
  set: (state: CountriesMapViewState) => {
    try {
      localStorage.setItem(COUNTRIES_MAP_VIEW_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore localStorage write errors (private mode, quota exceeded, etc.)
    }
  },

  get: (): CountriesMapViewState | null => {
    try {
      const raw = localStorage.getItem(COUNTRIES_MAP_VIEW_STATE_KEY);
      if (!raw) return null;

      const parsed = countriesMapViewStateSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  },

  clear: () => {
    localStorage.removeItem(COUNTRIES_MAP_VIEW_STATE_KEY);
  },
};

const countriesMapLockedSchema = z.boolean();

export const countriesMapLocked = {
  set: (locked: boolean) => {
    try {
      localStorage.setItem(COUNTRIES_MAP_LOCKED_KEY, JSON.stringify(locked));
    } catch {
      // Ignore localStorage write errors (private mode, quota exceeded, etc.)
    }
  },

  get: (): boolean => {
    try {
      const raw = localStorage.getItem(COUNTRIES_MAP_LOCKED_KEY);
      if (!raw) return false;

      const parsed = countriesMapLockedSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : false;
    } catch {
      return false;
    }
  },

  clear: () => {
    localStorage.removeItem(COUNTRIES_MAP_LOCKED_KEY);
  },
};

const globeViewStateSchema = z.object({
  scale: z.number().finite(),
  offset: z.tuple([z.number().finite(), z.number().finite()]),
  phi: z.number().finite(),
  theta: z.number().finite(),
  autoRotate: z.boolean().optional(),
  locked: z.boolean().optional(),
});
export type GlobeViewState = z.infer<typeof globeViewStateSchema>;

export const globeViewState = {
  set: (state: GlobeViewState) => {
    try {
      localStorage.setItem(GLOBE_VIEW_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignore localStorage write errors (private mode, quota exceeded, etc.)
    }
  },

  get: (): GlobeViewState | null => {
    try {
      const raw = localStorage.getItem(GLOBE_VIEW_STATE_KEY);
      if (!raw) return null;

      const parsed = globeViewStateSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  },

  clear: () => {
    localStorage.removeItem(GLOBE_VIEW_STATE_KEY);
  },
};
