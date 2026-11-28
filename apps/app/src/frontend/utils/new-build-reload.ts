const RELOAD_AT_STORAGE_KEY = 'vemetric-new-build-reload-at';
const RELOAD_COOLDOWN_MS = 60_000;

let reloading = false;

export const isReloadingForNewBuild = (): boolean => reloading;

/**
 * Reloads the page to pick up a newly deployed build, after a chunk of the old build failed to load.
 *
 * Reloads at most once per minute, so a chunk that keeps failing for another reason (blocked by an
 * extension, flaky network) can't cause a reload loop. When it doesn't reload, the error route shows
 * the error with a manual refresh link.
 */
export const reloadForNewBuild = (reload: () => void = () => window.location.reload()): void => {
  if (reloading) return;

  try {
    const lastReloadAt = Number(sessionStorage.getItem(RELOAD_AT_STORAGE_KEY));
    if (lastReloadAt && Date.now() - lastReloadAt < RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(RELOAD_AT_STORAGE_KEY, String(Date.now()));
  } catch {
    // without session storage we can't detect a reload loop, so we don't reload automatically
    return;
  }

  reloading = true;
  reload();
};
