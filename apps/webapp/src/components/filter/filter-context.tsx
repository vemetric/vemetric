import { createContext, useContext } from 'react';

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
}

export const FilterContext = createContext<FilterContextType>({
  pagePaths: [],
  eventNames: [],
  countryCodes: [],
  origins: [],
  referrers: [],
  referrerUrls: [],
  utmCampaigns: [],
  utmContents: [],
  utmMediums: [],
  utmSources: [],
  utmTerms: [],
  browserNames: [],
  deviceTypes: [],
  osNames: [],
});

export const useFilterContext = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  return context;
};
