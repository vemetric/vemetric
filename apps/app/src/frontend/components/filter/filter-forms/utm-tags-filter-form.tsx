import { Button, Flex, Grid } from '@chakra-ui/react';
import type { IUtmTagsFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbWorldQuestion } from 'react-icons/tb';
import { useFilterContext } from '../filter-context';
import { StringFilterRow } from '../filter-rows/string/string-filter-row';

export const UtmTagsFilterTitle = () => (
  <>
    <TbWorldQuestion />
    UTM Tags Filter
  </>
);

interface Props {
  filter?: IUtmTagsFilter;
  onSubmit: (filter: IUtmTagsFilter) => void;
  buttonText: string;
}

export const UtmTagsFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const { utmCampaigns, utmContents, utmMediums, utmSources, utmTerms } = useFilterContext();
  const [filter, setFilter] = useState<IUtmTagsFilter>(
    _filter ?? {
      type: 'utmTags',
      utmCampaignFilter: { value: '', operator: 'is' },
    },
  );
  const {
    utmCampaignFilter = { value: '', operator: 'any' },
    utmContentFilter = { value: '', operator: 'any' },
    utmMediumFilter = { value: '', operator: 'any' },
    utmSourceFilter = { value: '', operator: 'any' },
    utmTermFilter = { value: '', operator: 'any' },
  } = filter;

  return (
    <Flex
      as="form"
      p={2}
      flexDir="column"
      gap={2}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(filter);
      }}
    >
      <Grid gridTemplateColumns="1fr 1fr 3fr" gap={2} p={2} alignItems="center">
        <StringFilterRow
          label="Campaign"
          values={utmCampaigns}
          filter={utmCampaignFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.utmCampaignFilter = newFilter;
              }),
            );
          }}
        />
        <StringFilterRow
          label="Content"
          values={utmContents}
          filter={utmContentFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.utmContentFilter = newFilter;
              }),
            );
          }}
        />
        <StringFilterRow
          label="Medium"
          values={utmMediums}
          filter={utmMediumFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.utmMediumFilter = newFilter;
              }),
            );
          }}
        />
        <StringFilterRow
          label="Source"
          values={utmSources}
          filter={utmSourceFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.utmSourceFilter = newFilter;
              }),
            );
          }}
        />
        <StringFilterRow
          label="Term"
          values={utmTerms}
          filter={utmTermFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.utmTermFilter = newFilter;
              }),
            );
          }}
        />
      </Grid>
      <Flex justify="flex-end">
        <Button type="submit" size="2xs" rounded="sm">
          {buttonText}
        </Button>
      </Flex>
    </Flex>
  );
};
