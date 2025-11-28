import { useNavigate } from '@tanstack/react-router';
import { renderHook } from '@testing-library/react';
import type { IFilter, IFilterConfig } from '@vemetric/common/filters';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterContextProvider } from '../../src/components/filter/filter-context';
import { useFilters } from '../../src/hooks/use-filters';

// Mock useNavigate hook
vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(),
}));

// Create a wrapper component that provides the FilterContext
const createWrapper = () => {
  const wrapper = ({ children }: { children: ReactNode }) => {
    return createElement(
      FilterContextProvider,
      {
        value: {
          pagePaths: [],
          origins: [],
          eventNames: ['page_view', 'click'],
          countryCodes: ['US', 'CA'],
          referrers: [],
          referrerUrls: [],
          utmCampaigns: [],
          utmContents: [],
          utmMediums: [],
          utmSources: [],
          utmTerms: [],
          browserNames: ['chrome', 'firefox'],
          deviceTypes: ['desktop', 'mobile'],
          osNames: ['windows', 'mac'],
          defaultOperator: 'and',
        },
      },
      children,
    );
  };
  return wrapper;
};

describe('useFilters', () => {
  const mockNavigate = vi.fn();
  const mockSearch = {
    f: {
      filters: [],
      operator: 'and' as const,
    },
    e: undefined,
    p: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  it('should set filters correctly', () => {
    // Setup: Create hook and test data
    const { result: hookResult } = renderHook(() => useFilters({ from: '/p/$projectId' }), {
      wrapper: createWrapper(),
    });
    const newFilters: IFilterConfig = {
      filters: [
        {
          type: 'event',
          nameFilter: {
            value: 'page_view',
            operator: 'is',
          },
        },
      ],
      operator: 'and',
    };

    // Action: Call setFilters which internally calls navigate
    hookResult.current.setFilters(newFilters);

    // Assert: Verify navigate was called with the correct arguments
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
      resetScroll: false,
    });

    // Test: Get the search function that was passed to navigate (which holds the actual implementation) and test it
    const searchFn = mockNavigate.mock.calls[0][0].search;
    const searchResult = searchFn(mockSearch);

    // Assert: Verify the search function correctly transformed the state
    expect(searchResult.f).toEqual(newFilters);
    expect(searchResult.e).toBe(true); // Event filter was added
  });

  it('should remove all filters', () => {
    // Setup: Create hook
    const { result: hookResult } = renderHook(() => useFilters({ from: '/p/$projectId' }), {
      wrapper: createWrapper(),
    });

    // Action: Call removeAllFilters which internally calls navigate
    hookResult.current.removeAllFilters();

    // Assert: Verify navigate was called with the correct arguments
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
      resetScroll: false,
    });

    // Test: Get the search function that was passed to navigate (which holds the actual implementation) and test it
    const searchFn = mockNavigate.mock.calls[0][0].search;
    const searchResult = searchFn(mockSearch);

    // Assert: Verify the search function correctly removed all filters
    expect(searchResult.f).toBeUndefined();
  });

  it('should toggle filter on when it does not exist', () => {
    // Setup: Create hook and test data
    const { result: hookResult } = renderHook(() => useFilters({ from: '/p/$projectId' }), {
      wrapper: createWrapper(),
    });
    const newFilter: IFilter = {
      type: 'event',
      nameFilter: {
        value: 'page_view',
        operator: 'is',
      },
    };

    // Action: Call toggleFilter which internally calls navigate
    hookResult.current.toggleFilter(newFilter);

    // Test: Get the search function that was passed to navigate (which holds the actual implementation) and test it
    const searchFn = mockNavigate.mock.calls[0][0].search;
    const searchResult = searchFn(mockSearch);

    // Assert: Verify the search function correctly added the new filter
    expect(searchResult.f?.filters).toContainEqual(newFilter);
    expect(searchResult.f?.operator).toBe('and'); // Should use the default operator from context
  });

  it('should toggle filter off when it exists', () => {
    // Setup: Create hook and test data
    const { result: hookResult } = renderHook(() => useFilters({ from: '/p/$projectId' }), {
      wrapper: createWrapper(),
    });
    const existingFilter: IFilter = {
      type: 'event',
      nameFilter: {
        value: 'page_view',
        operator: 'is',
      },
    };
    const initialFilters: IFilterConfig = {
      filters: [existingFilter],
      operator: 'and',
    };

    // Action: Call toggleFilter which internally calls navigate
    hookResult.current.toggleFilter(existingFilter);

    // Test: Get the search function that was passed to navigate (which holds the actual implementation) and test it
    const searchFn = mockNavigate.mock.calls[0][0].search;
    const searchResult = searchFn({ ...mockSearch, f: initialFilters });

    // Assert: Verify the search function correctly removed the filter
    expect(searchResult.f).toBeUndefined();
  });

  it('should remove filter config when last filter is removed', () => {
    // Setup: Create hook and test data
    const { result: hookResult } = renderHook(() => useFilters({ from: '/p/$projectId' }), {
      wrapper: createWrapper(),
    });
    const existingFilter: IFilter = {
      type: 'event',
      nameFilter: {
        value: 'page_view',
        operator: 'is',
      },
    };
    const initialFilters: IFilterConfig = {
      filters: [existingFilter],
      operator: 'and',
    };

    // Action: Call toggleFilter which internally calls navigate
    hookResult.current.toggleFilter(existingFilter);

    // Test: Get the search function that was passed to navigate (which holds the actual implementation) and test it
    const searchFn = mockNavigate.mock.calls[0][0].search;
    const searchResult = searchFn({ ...mockSearch, f: initialFilters });

    // Assert: Verify the search function correctly removed the entire filter config
    expect(searchResult.f).toBeUndefined();
  });

  it('should preserve existing event flag when adding non-event filter', () => {
    // Setup: Create hook and test data
    const { result: hookResult } = renderHook(() => useFilters({ from: '/p/$projectId' }), {
      wrapper: createWrapper(),
    });
    const newFilter: IFilter = {
      type: 'browser',
      browserFilter: {
        value: ['chrome'],
        operator: 'oneOf',
      },
    };
    const initialSearch = { ...mockSearch, e: true };

    // Action: Call setFilters which internally calls navigate
    hookResult.current.setFilters({
      filters: [newFilter],
      operator: 'and',
    });

    // Test: Get the search function that was passed to navigate (which holds the actual implementation) and test it
    const searchFn = mockNavigate.mock.calls[0][0].search;
    const searchResult = searchFn(initialSearch);

    // Assert: Verify the search function preserved the event flag
    expect(searchResult.e).toBe(true);
  });
});
