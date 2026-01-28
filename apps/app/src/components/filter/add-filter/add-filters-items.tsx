import { BrowserFilterForm, BrowserFilterTitle } from '../filter-forms/browser-filter-form';
import { DeviceFilterTitle, DeviceFilterForm } from '../filter-forms/device-filter-form';
import { EventFilterForm, EventFilterTitle } from '../filter-forms/event-filter-form';
import { FunnelFilterForm, FunnelFilterTitle } from '../filter-forms/funnel-filter-form';
import { LocationFilterForm, LocationFilterTitle } from '../filter-forms/location-filter-form';
import { OsFilterForm, OsFilterTitle } from '../filter-forms/os-filter-form';
import { PageFilterForm, PageFilterTitle } from '../filter-forms/page-filter-form';
import { ReferrerFilterForm, ReferrerFilterTitle } from '../filter-forms/referrer-filter-form';
import { ReferrerTypeFilterForm, ReferrerTypeFilterTitle } from '../filter-forms/referrer-type-form';
import { ReferrerUrlFilterForm, ReferrerUrlFilterTitle } from '../filter-forms/referrer-url-form';
import { UserFilterForm, UserFilterTitle } from '../filter-forms/user-filter-form';
import { UtmTagsFilterForm, UtmTagsFilterTitle } from '../filter-forms/utm-tags-filter-form';

export const ADD_FILTER_ITEMS = {
  page: {
    title: <PageFilterTitle />,
    filterForm: PageFilterForm,
  },
  event: {
    title: <EventFilterTitle />,
    filterForm: EventFilterForm,
  },
  funnel: {
    title: <FunnelFilterTitle />,
    filterForm: FunnelFilterForm,
  },
  user: {
    title: <UserFilterTitle />,
    filterForm: UserFilterForm,
  },
  location: {
    title: <LocationFilterTitle />,
    filterForm: LocationFilterForm,
  },
  referrer: {
    title: <ReferrerFilterTitle />,
    filterForm: ReferrerFilterForm,
  },
  referrerUrl: {
    title: <ReferrerUrlFilterTitle />,
    filterForm: ReferrerUrlFilterForm,
  },
  referrerType: {
    title: <ReferrerTypeFilterTitle />,
    filterForm: ReferrerTypeFilterForm,
  },
  utmTags: {
    title: <UtmTagsFilterTitle />,
    filterForm: UtmTagsFilterForm,
  },
  browser: {
    title: <BrowserFilterTitle />,
    filterForm: BrowserFilterForm,
  },
  device: {
    title: <DeviceFilterTitle />,
    filterForm: DeviceFilterForm,
  },
  os: {
    title: <OsFilterTitle />,
    filterForm: OsFilterForm,
  },
};
