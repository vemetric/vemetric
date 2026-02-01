const REDIRECT_PATH_KEY = 'redirectPath';

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
