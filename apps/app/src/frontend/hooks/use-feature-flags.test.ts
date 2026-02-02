import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFeatureFlags } from './use-feature-flags';
import { authClient } from '../utils/auth';

// Mock the auth client
vi.mock('../utils/auth', () => ({
  authClient: {
    useSession: vi.fn(),
  },
}));

describe('useFeatureFlags', () => {
  const mockSession = {
    projects: [
      {
        id: 'project-1',
        organizationId: 'org-1',
      },
    ],
    organizations: [
      {
        id: 'org-1',
        featureFlags: 'feature1,feature2,feature3',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when projectId is undefined', () => {
    (authClient.useSession as any).mockReturnValue({ data: mockSession });
    const { result } = renderHook(() => useFeatureFlags(undefined));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return false when projectId is null', () => {
    (authClient.useSession as any).mockReturnValue({ data: mockSession });
    const { result } = renderHook(() => useFeatureFlags(null));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return false when project is not found', () => {
    (authClient.useSession as any).mockReturnValue({ data: mockSession });
    const { result } = renderHook(() => useFeatureFlags('non-existent-project'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return false when organization is not found', () => {
    (authClient.useSession as any).mockReturnValue({
      data: {
        ...mockSession,
        organizations: [{ id: 'different-org', featureFlags: 'feature1' }],
      },
    });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return false when feature flags are not set', () => {
    (authClient.useSession as any).mockReturnValue({
      data: {
        ...mockSession,
        organizations: [{ id: 'org-1', featureFlags: undefined }],
      },
    });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return true when feature flag exists', () => {
    (authClient.useSession as any).mockReturnValue({ data: mockSession });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(true);
    expect(result.current.hasFeatureFlag('feature2')).toBe(true);
    expect(result.current.hasFeatureFlag('feature3')).toBe(true);
  });

  it('should return false when feature flag does not exist', () => {
    (authClient.useSession as any).mockReturnValue({ data: mockSession });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('non-existent-feature')).toBe(false);
  });

  it('should handle empty feature flags string', () => {
    (authClient.useSession as any).mockReturnValue({
      data: {
        ...mockSession,
        organizations: [{ id: 'org-1', featureFlags: '' }],
      },
    });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should handle feature flags with spaces', () => {
    (authClient.useSession as any).mockReturnValue({
      data: {
        ...mockSession,
        organizations: [{ id: 'org-1', featureFlags: 'feature1, feature2, feature3' }],
      },
    });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(true);
    expect(result.current.hasFeatureFlag('feature2')).toBe(true);
    expect(result.current.hasFeatureFlag('feature3')).toBe(true);
  });
});
