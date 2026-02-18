
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearQueryClientMock = vi.fn();
const signOutMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    clear: clearQueryClientMock,
  }),
}));

vi.mock('better-auth/react', () => ({
  createAuthClient: vi.fn(() => ({
    signOut: signOutMock,
    signIn: {
      social: vi.fn(),
    },
  })),
}));

import { useLogout } from './auth';

describe('useLogout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue(undefined);
    sessionStorage.clear();
  });

  it('should clear session storage and query cache after sign out', async () => {
    sessionStorage.setItem('timespan', 'month');

    const { result } = renderHook(() => useLogout());

    await result.current.logout();

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(sessionStorage.length).toBe(0);
    expect(clearQueryClientMock).toHaveBeenCalledOnce();
  });
});
