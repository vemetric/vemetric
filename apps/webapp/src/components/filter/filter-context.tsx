import { createContext, useContext } from 'react';
import type { ADD_FILTER_ITEMS } from './add-filter/add-filters-items';

interface FilterContextType {
  pagePaths: string[];
  eventNames: string[];
  countryCodes: string[];
  origins: string[];
  referrers: string[];
  referrerUrls: string[];
  utmCampaigns: string[];
  utmContents: string[];
  utmMediums: string[];
  utmSources: string[];
  utmTerms: string[];
  browserNames: string[];
  deviceTypes: string[];
  osNames: string[];
  disabledFilters?: Array<keyof typeof ADD_FILTER_ITEMS>;
  defaultOperator?: 'and' | 'or';
}

const FilterContext = createContext<FilterContextType | null>(null);

export const FilterContextProvider = FilterContext.Provider;

export const useFilterContext = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  return context;
};
