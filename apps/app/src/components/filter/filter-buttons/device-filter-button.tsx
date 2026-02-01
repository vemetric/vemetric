import { Box, Button, Flex, Icon, Text } from '@chakra-ui/react';
import type { IDeviceFilter } from '@vemetric/common/filters';
import { Fragment } from 'react';
import { TbCircleDashedNumber0, TbDevices } from 'react-icons/tb';
import { DeviceIcon } from '@/components/device-icon';
import { FilterButton } from '../filter-button';
import { DeviceFilterForm, DeviceFilterTitle } from '../filter-forms/device-filter-form';

interface Props {
  filter: IDeviceFilter;
  onChange: (filter: IDeviceFilter) => void;
  onDelete: () => void;
}

export const DeviceFilterButton = ({ filter, onChange, onDelete }: Props) => {
  const { deviceFilter = { value: [], operator: 'any' } } = filter;

  const popoverContent = (
    <Box>
      <Flex
        align="center"
        fontWeight="semibold"
        fontSize="md"
        gap={1}
        p={2}
        borderBottom="1px solid"
        borderColor="border.emphasized/60"
        mb={1}
      >
        <Flex justify="space-between" w="100%">
          <Flex align="center" gap={1.5}>
            <DeviceFilterTitle />
          </Flex>
          <Button size="2xs" variant="ghost" rounded="sm" colorPalette="red" onClick={onDelete}>
            Delete Delete
          </Button>
        </Flex>
      </Flex>
      <DeviceFilterForm filter={filter} onSubmit={onChange} buttonText="Save" />
    </Box>
  );

  return (
    <FilterButton filter={filter} popoverContent={popoverContent} onDelete={onDelete}>
      <Flex align="center" gap={1.5}>
        <Flex align="center" fontWeight="medium" gap={1}>
          <TbDevices />
          <Text>Device</Text>
        </Flex>
        <Text fontSize="xs" fontWeight="medium">
          {deviceFilter.operator}
        </Text>
        {deviceFilter.operator !== 'any' && (
          <Flex align="center" gap={0} flexWrap="wrap">
            {deviceFilter.value.length > 0 ? (
              deviceFilter.value.slice(0, 3).map((device, index) => (
                <Fragment key={device}>
                  {index > 0 && <>,&nbsp;</>}
                  <DeviceIcon key={device} deviceType={device} />
                </Fragment>
              ))
            ) : (
              <Icon as={TbCircleDashedNumber0} color="fg.muted" />
            )}
            {deviceFilter.value.length > 3 && (
              <Text fontSize="xs" fontWeight="medium">
                , ...
              </Text>
            )}
          </Flex>
        )}
      </Flex>
    </FilterButton>
  );
};
