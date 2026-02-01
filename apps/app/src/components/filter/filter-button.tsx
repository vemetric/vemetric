import type { PopoverContentProps } from '@chakra-ui/react';
import { Box, Flex, Icon, Popover, Portal } from '@chakra-ui/react';
import { hasMultipleSubfiltersActive, type IFilter } from '@vemetric/common/filters';
import { type PropsWithChildren } from 'react';
import { TbCircleDashedPlus } from 'react-icons/tb';
import { DeleteIconButton } from '../delete-icon-button';
import { FilterTooltip } from './filter-tooltip';

interface Props {
  filter: IFilter;
  popoverProps?: PopoverContentProps;
  popoverContent?: React.ReactNode;
  onDelete: () => void;
}

export const FilterButton = ({
  children,
  popoverProps,
  popoverContent,
  onDelete,
  filter,
}: PropsWithChildren<Props>) => {
  const multipleSubfiltersActive = hasMultipleSubfiltersActive(filter);

  return (
    <Box pos="relative" className="group">
      <Popover.Root unmountOnExit positioning={{ placement: 'bottom-start', gutter: 5 }}>
        <Popover.Trigger>
          <FilterTooltip filter={filter}>
            <Flex
              border="1.5px solid"
              borderColor="purple.emphasized"
              bg="bg.content"
              px={2}
              py={0.5}
              rounded="md"
              align="center"
              justify="center"
              textStyle="sm"
              cursor="pointer"
              transition="all 0.2s ease-in-out"
              _hover={{ opacity: 0.8 }}
              onMouseUp={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }
              }}
            >
              {children}
              {multipleSubfiltersActive && <Icon as={TbCircleDashedPlus} ml={1} color="purple.500" />}
            </Flex>
          </FilterTooltip>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content border="1.5px solid" borderColor="purple.emphasized" {...popoverProps}>
              {popoverContent}
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
      <DeleteIconButton onClick={onDelete} />
    </Box>
  );
};
