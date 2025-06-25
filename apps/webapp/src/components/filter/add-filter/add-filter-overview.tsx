import { Flex, Button } from '@chakra-ui/react';
import { PopoverMenuButton } from '@/components/popover-menu/popover-menu-button';
import { PopoverMenuHeader } from '@/components/popover-menu/popover-menu-header';
import { useFilters } from '@/hooks/use-filters';
import { BrowserFilterForm, BrowserFilterTitle } from '../filter-forms/browser-filter-form';
import { DeviceFilterTitle, DeviceFilterForm } from '../filter-forms/device-filter-form';
import { EventFilterForm, EventFilterTitle } from '../filter-forms/event-filter-form';
import { LocationFilterForm, LocationFilterTitle } from '../filter-forms/location-filter-form';
import { OsFilterForm, OsFilterTitle } from '../filter-forms/os-filter-form';
import { PageFilterForm, PageFilterTitle } from '../filter-forms/page-filter-form';
import { ReferrerFilterForm, ReferrerFilterTitle } from '../filter-forms/referrer-filter-form';
import { ReferrerTypeFilterForm, ReferrerTypeFilterTitle } from '../filter-forms/referrer-type-form';
import { ReferrerUrlFilterForm, ReferrerUrlFilterTitle } from '../filter-forms/referrer-url-form';
import { UserFilterForm, UserFilterTitle } from '../filter-forms/user-filter-form';
import { UtmTagsFilterForm, UtmTagsFilterTitle } from '../filter-forms/utm-tags-filter-form';

export const ADD_FILTERS = {
  page: {
    title: <PageFilterTitle />,
    filterForm: PageFilterForm,
  },
  event: {
    title: <EventFilterTitle />,
    filterForm: EventFilterForm,
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

interface Props {
  from: '/p/$projectId' | '/p/$projectId/users' | '/public/$domain';
  setFilterView: (view: string) => void;
  onClose: () => void;
}

export const AddFilterOverview = ({ from, setFilterView, onClose }: Props) => {
  const { removeAllFilters } = useFilters({ from });

  return (
    <>
      <PopoverMenuHeader title="Add Filter">
        <Button
          variant="surface"
          size="2xs"
          rounded="sm"
          onClick={() => {
            removeAllFilters();
            onClose();
          }}
        >
          Reset all
        </Button>
      </PopoverMenuHeader>
      <Flex
        flexDir="column"
        bg="purple.muted"
        roundedBottom="md"
        overflow="hidden"
        css={{
          '& > *:not(:last-child)': { borderBottom: '1px solid var(--chakra-colors-border-muted)' },
        }}
      >
        {Object.entries(ADD_FILTERS).map(([key, { title }]) => (
          <PopoverMenuButton
            key={key}
            onClick={() => {
              setFilterView(key);
            }}
          >
            {title}
          </PopoverMenuButton>
        ))}
      </Flex>
    </>
  );
};
