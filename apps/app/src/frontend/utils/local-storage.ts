import { z } from 'zod';

const REDIRECT_PATH_KEY = 'redirectPath';
const COUNTRIES_MAP_VIEW_STATE_KEY = 'countries-map:view-state';

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
