import { useNavigate } from '@tanstack/react-router';
import type { IFilter, IFilterConfig } from '@vemetric/common/filters';
import { isDeepEqual } from 'remeda';

interface Props {
  from: '/p/$projectId' | '/p/$projectId/users' | '/public/$domain';
}

export const useFilters = ({ from }: Props) => {
  const navigate = useNavigate({ from });

  const setFilters = (filterConfig: IFilterConfig | ((prev: IFilterConfig) => IFilterConfig)) => {
    navigate({
      search: (prev) => {
        const newFilters = typeof filterConfig === 'function' ? filterConfig(prev.f) : filterConfig;

        // when the user adds an event filter, we want to show the events in the chart
        const addedEventFilter =
          !prev.f?.filters.some((f) => f.type === 'event') && newFilters?.filters.some((f) => f.type === 'event');

        return { ...prev, p: undefined, f: newFilters, e: addedEventFilter ? true : 'e' in prev ? prev.e : undefined };
      },
      resetScroll: false,
    });
  };

  const removeAllFilters = () => {
    navigate({
      search: (prev) => {
        return {
          ...prev,
          f: undefined,
        };
      },
      resetScroll: false,
    });
  };

  const toggleFilter = (filter: IFilter) => {
    setFilters((prev) => {
      if (!prev) {
        return { filters: [filter], operator: 'and' };
      }

      const existingFilterIndex = prev.filters.findIndex((f) => {
        return isDeepEqual(f, filter);
      });
      if (existingFilterIndex !== -1) {
        const newFilters = prev.filters.filter((_, index) => index !== existingFilterIndex);
        return newFilters.length > 0 ? { ...prev, filters: newFilters } : undefined;
      }

      return { ...prev, filters: [...prev.filters, filter] };
    });
  };

  return {
    setFilters,
    removeAllFilters,
    toggleFilter,
  };
};
