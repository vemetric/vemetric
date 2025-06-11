import type { IFilterConfig } from '@vemetric/common/filters';
import type { ISources } from '@vemetric/common/sources';
import {
  buildReferrerFilterQueries,
  buildReferrerUrlFilterQueries,
  buildReferrerTypeFilterQueries,
} from './referrer-filter';
import {
  buildUtmCampaignFilterQueries,
  buildUtmContentFilterQueries,
  buildUtmMediumFilterQueries,
  buildUtmSourceFilterQueries,
  buildUtmTermFilterQueries,
} from './utm-tags-filter';

export const buildSourceFilterQueries = (filterConfig: IFilterConfig, source: ISources) => {
  if (!filterConfig) {
    return '';
  }

  switch (source) {
    case 'referrer':
      return buildReferrerFilterQueries(filterConfig);
    case 'referrerUrl':
      return buildReferrerUrlFilterQueries(filterConfig);
    case 'referrerType':
      return buildReferrerTypeFilterQueries(filterConfig);
    case 'utmCampaign':
      return buildUtmCampaignFilterQueries(filterConfig);
    case 'utmContent':
      return buildUtmContentFilterQueries(filterConfig);
    case 'utmMedium':
      return buildUtmMediumFilterQueries(filterConfig);
    case 'utmSource':
      return buildUtmSourceFilterQueries(filterConfig);
    case 'utmTerm':
      return buildUtmTermFilterQueries(filterConfig);
    default:
      return '';
  }
};
