import type { ButtonProps } from '@chakra-ui/react';
import { Flex, Button } from '@chakra-ui/react';
import { useFilters } from '@/hooks/use-filters';
import { AddFilterTitle } from './add-filter-title';
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

const FilterMenuButton = (props: ButtonProps) => (
  <Button
    variant="ghost"
    bg="bg"
    size="sm"
    textAlign="left"
    px={2}
    rounded="none"
    justifyContent="flex-start"
    transition="transform 0.2s ease-out"
    _hover={{ transform: 'translateX(3px)' }}
    {...props}
  />
);

interface Props {
  from: '/p/$projectId' | '/p/$projectId/users' | '/public/$domain';
  setFilterView: (view: string) => void;
  onClose: () => void;
}

export const AddFilterOverview = ({ from, setFilterView, onClose }: Props) => {
  const { removeAllFilters } = useFilters({ from });

  return (
    <>
      <AddFilterTitle title="Add Filter">
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
      </AddFilterTitle>
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
          <FilterMenuButton
            key={key}
            onClick={() => {
              setFilterView(key);
            }}
          >
            {title}
          </FilterMenuButton>
        ))}
      </Flex>
    </>
  );
};
