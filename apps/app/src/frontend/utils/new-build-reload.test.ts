import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// a fresh module instance stands in for a freshly loaded page
const loadModule = async () => {
  vi.resetModules();
  return import('./new-build-reload');
};

describe('reloadForNewBuild', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reloads once, even if several chunks fail', async () => {
    const { reloadForNewBuild, isReloadingForNewBuild } = await loadModule();
    const reload = vi.fn();

    expect(isReloadingForNewBuild()).toBe(false);
    reloadForNewBuild(reload);
    reloadForNewBuild(reload);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(isReloadingForNewBuild()).toBe(true);
  });

  it('does not reload again when a chunk still fails right after the reload', async () => {
    const reload = vi.fn();
    (await loadModule()).reloadForNewBuild(reload);

    vi.advanceTimersByTime(5_000);
    const afterReload = await loadModule();
    afterReload.reloadForNewBuild(reload);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(afterReload.isReloadingForNewBuild()).toBe(false);
  });

  it('reloads again for a later deployment', async () => {
    const reload = vi.fn();
    (await loadModule()).reloadForNewBuild(reload);

    vi.advanceTimersByTime(61_000);
    (await loadModule()).reloadForNewBuild(reload);

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does not reload when session storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { reloadForNewBuild, isReloadingForNewBuild } = await loadModule();
    const reload = vi.fn();

    reloadForNewBuild(reload);

    expect(reload).not.toHaveBeenCalled();
    expect(isReloadingForNewBuild()).toBe(false);
  });
});
