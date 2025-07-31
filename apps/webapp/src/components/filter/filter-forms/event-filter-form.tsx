import { Box, Button, Flex, Grid, IconButton, Text } from '@chakra-ui/react';
import type { IEventFilter, IStringFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import React, { useState } from 'react';
import { TbBolt, TbPlus, TbTrash } from 'react-icons/tb';
import { useProjectContext } from '@/contexts/project-context';
import { trpc } from '@/utils/trpc';
import { useFilterContext } from '../filter-context';
import { StringFilterRow } from '../filter-rows/string/string-filter-row';
import { StringOperatorButton } from '../filter-rows/string/string-operator-button';
import { StringValueInput } from '../filter-rows/string/string-value-input';

export const EventFilterTitle = () => (
  <>
    <TbBolt /> Event Filter
  </>
);

interface Props {
  filter?: IEventFilter;
  onChange?: (filter: IEventFilter) => void;
  onSubmit?: (filter: IEventFilter) => void;
  buttonText?: string;
}

export const EventFilterForm = ({ filter: _filter, onChange, onSubmit, buttonText = 'Save' }: Props) => {
  const { projectId, domain } = useProjectContext();
  const { eventNames } = useFilterContext();
  const [filter, setFilter] = useState<IEventFilter>(
    _filter ?? {
      type: 'event',
      nameFilter: { operator: 'is', value: '' },
      propertiesFilter: [],
    },
  );
  const { nameFilter = { value: '', operator: 'any' } } = filter;

  const { data: propertyValues, isLoading } = trpc.filters.getEventPropertiesWithValues.useQuery(
    {
      projectId,
      domain,
      eventName: nameFilter.value,
      operator: nameFilter.operator,
    },
    {
      enabled: !!nameFilter.value && (filter.propertiesFilter?.length ?? 0) > 0,
    },
  );

  const addPropertyFilter = () => {
    const newFilter = produce(filter, (draft) => {
      if (!draft.propertiesFilter) draft.propertiesFilter = [];
      draft.propertiesFilter.push({
        property: '',
        valueFilter: { operator: 'is', value: '' },
      });
    });

    setFilter(newFilter);
    onChange?.(newFilter);
  };

  const removePropertyFilter = (index: number) => {
    const newFilter = produce(filter, (draft) => {
      draft.propertiesFilter?.splice(index, 1);
    });

    setFilter(newFilter);
    onChange?.(newFilter);
  };

  const updatePropertyFilter = (index: number, property: string, valueFilter: IStringFilter) => {
    const newFilter = produce(filter, (draft) => {
      if (!draft.propertiesFilter) draft.propertiesFilter = [];
      draft.propertiesFilter[index] = {
        property,
        valueFilter,
      };
    });

    setFilter(newFilter);
    onChange?.(newFilter);
  };

  return (
    <Flex
      as={onSubmit ? 'form' : 'div'}
      flexDir="column"
      gap={2}
      onSubmit={
        onSubmit
          ? (e) => {
              e.preventDefault();
              onSubmit(filter);
            }
          : undefined
      }
    >
      <Grid gridTemplateColumns="1fr 1fr 4fr" gap={2} p={2} pb="0" alignItems="center">
        <StringFilterRow
          label="Name"
          filter={nameFilter}
          values={eventNames}
          onChange={(nameFilter) => {
            const newFilter = produce(filter, (draft) => {
              draft.nameFilter = nameFilter;
            });

            setFilter(newFilter);
            onChange?.(newFilter);
          }}
        />
      </Grid>

      {(filter.propertiesFilter?.length ?? 0) > 0 && (
        <Box p="2" pb="0">
          <Text fontWeight="semibold" mb="1">
            Property Filters
          </Text>
          <Grid
            gridTemplateColumns="2fr 0.5fr 2fr 0.5fr"
            gap={2}
            alignItems="center"
            border="1px solid"
            borderColor="border.emphasized"
            borderRadius="md"
            p="1"
          >
            {filter.propertiesFilter?.map((propertyFilter, index) => (
              <React.Fragment key={index}>
                <StringValueInput
                  placeholder="Property"
                  key={nameFilter.operator + ';' + nameFilter.value + ';' + (isLoading ? 'loading' : 'loaded')}
                  filter={{ operator: 'is', value: propertyFilter.property }}
                  values={Object.keys(propertyValues ?? {})}
                  onChange={(value) => {
                    updatePropertyFilter(index, value, propertyFilter.valueFilter);
                  }}
                />
                <Flex justify="center">
                  <StringOperatorButton
                    operator={propertyFilter.valueFilter.operator}
                    onChange={(operator) => {
                      updatePropertyFilter(index, propertyFilter.property, {
                        operator,
                        value: propertyFilter.valueFilter.value,
                      });
                    }}
                  />
                </Flex>
                <StringValueInput
                  placeholder="Value"
                  key={propertyFilter.property + ';' + (isLoading ? 'loading' : 'loaded')}
                  filter={propertyFilter.valueFilter}
                  values={propertyValues?.[propertyFilter.property] ?? []}
                  onChange={(value) => {
                    updatePropertyFilter(index, propertyFilter.property, {
                      operator: propertyFilter.valueFilter.operator,
                      value,
                    });
                  }}
                />
                <IconButton
                  aria-label="Remove property filter"
                  size="2xs"
                  variant="ghost"
                  colorPalette="red"
                  onClick={() => removePropertyFilter(index)}
                >
                  <TbTrash />
                </IconButton>
              </React.Fragment>
            ))}
          </Grid>
        </Box>
      )}

      <Flex justify="space-between" align="center" p={2}>
        <Button size="2xs" rounded="sm" variant="surface" onClick={addPropertyFilter}>
          <TbPlus />
          Add Property Filter
        </Button>
        {onSubmit && (
          <Button type="submit" size="2xs" rounded="sm">
            {buttonText}
          </Button>
        )}
      </Flex>
    </Flex>
  );
};
