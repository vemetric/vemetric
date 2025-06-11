import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '../../src/hooks/use-auth';
import { useFeatureFlags } from '../../src/hooks/use-feature-flags';

// Mock the useAuth hook
vi.mock('../../src/hooks/use-auth', () => ({
  useAuth: vi.fn(),
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
    (useAuth as any).mockReturnValue({ session: mockSession });
    const { result } = renderHook(() => useFeatureFlags(undefined));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return false when projectId is null', () => {
    (useAuth as any).mockReturnValue({ session: mockSession });
    const { result } = renderHook(() => useFeatureFlags(null));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return false when project is not found', () => {
    (useAuth as any).mockReturnValue({ session: mockSession });
    const { result } = renderHook(() => useFeatureFlags('non-existent-project'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return false when organization is not found', () => {
    (useAuth as any).mockReturnValue({
      session: {
        ...mockSession,
        organizations: [{ id: 'different-org', featureFlags: 'feature1' }],
      },
    });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return false when feature flags are not set', () => {
    (useAuth as any).mockReturnValue({
      session: {
        ...mockSession,
        organizations: [{ id: 'org-1', featureFlags: undefined }],
      },
    });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should return true when feature flag exists', () => {
    (useAuth as any).mockReturnValue({ session: mockSession });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(true);
    expect(result.current.hasFeatureFlag('feature2')).toBe(true);
    expect(result.current.hasFeatureFlag('feature3')).toBe(true);
  });

  it('should return false when feature flag does not exist', () => {
    (useAuth as any).mockReturnValue({ session: mockSession });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('non-existent-feature')).toBe(false);
  });

  it('should handle empty feature flags string', () => {
    (useAuth as any).mockReturnValue({
      session: {
        ...mockSession,
        organizations: [{ id: 'org-1', featureFlags: '' }],
      },
    });
    const { result } = renderHook(() => useFeatureFlags('project-1'));
    expect(result.current.hasFeatureFlag('feature1')).toBe(false);
  });

  it('should handle feature flags with spaces', () => {
    (useAuth as any).mockReturnValue({
      session: {
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
