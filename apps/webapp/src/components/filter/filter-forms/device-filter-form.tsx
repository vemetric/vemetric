import { Button, createListCollection, Flex, Grid, Text } from '@chakra-ui/react';
import type { IDeviceFilter } from '@vemetric/common/filters';
import { produce } from 'immer';
import { useState } from 'react';
import { TbDevices } from 'react-icons/tb';
import { DeviceIcon } from '@/components/device-icon';
import { useFilterContext } from '../filter-context';
import { ListFilterRow } from '../filter-rows/list-filter-row';

export const DeviceFilterTitle = () => (
  <>
    <TbDevices />
    Device Filter
  </>
);

interface Props {
  filter?: IDeviceFilter;
  onSubmit: (filter: IDeviceFilter) => void;
  buttonText: string;
}

export const DeviceFilterForm = ({ filter: _filter, onSubmit, buttonText }: Props) => {
  const { deviceTypes } = useFilterContext();
  const [filter, setFilter] = useState<IDeviceFilter>(
    _filter ?? {
      type: 'device',
      deviceFilter: { value: [], operator: 'oneOf' },
    },
  );
  const { deviceFilter = { value: [], operator: 'any' } } = filter;

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
      <Grid gridTemplateColumns="1fr 1fr 4fr" gap={2} p={2} alignItems="center">
        <ListFilterRow
          label="Device"
          values={createListCollection({
            items: deviceTypes.map((name) => ({
              label: (
                <Flex gap={1.5} align="center">
                  <DeviceIcon deviceType={name} />
                  <Text className="value-hidden">{name}</Text>
                </Flex>
              ),
              value: name,
            })),
            itemToString: (item) => item.value,
            itemToValue: (item) => item.value,
          })}
          filter={deviceFilter}
          onChange={(newFilter) => {
            setFilter(
              produce(filter, (draft) => {
                draft.deviceFilter = newFilter;
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
