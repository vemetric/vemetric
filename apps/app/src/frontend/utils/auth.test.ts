import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient, useLogout } from './auth';

const clearQueryClientMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    clear: clearQueryClientMock,
  }),
}));

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('should clear session storage and query cache after sign out', async () => {
    const signOutMock = vi.spyOn(authClient, 'signOut').mockResolvedValue(undefined as never);

    sessionStorage.setItem('timespan', 'month');

    const { result } = renderHook(() => useLogout());

    await result.current.logout();

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(sessionStorage.length).toBe(0);
    expect(clearQueryClientMock).toHaveBeenCalledOnce();
  });
});
