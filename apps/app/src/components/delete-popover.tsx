import { Button, Flex, Text, Popover } from '@chakra-ui/react';
import type { PropsWithChildren } from 'react';

interface Props {
  onDelete: () => void;
  isLoading: boolean;
  placement?: 'top' | 'bottom';
  text: string;
}

export const DeletePopover = ({
  onDelete,
  isLoading,
  placement = 'bottom',
  text,
  children,
}: PropsWithChildren<Props>) => {
  return (
    <Popover.Root positioning={{ placement }}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content minW="none" maxW="200px">
          <Popover.CloseTrigger />
          <Popover.Arrow>
            <Popover.ArrowTip />
          </Popover.Arrow>
          <Popover.Body p={2.5}>
            <Text fontWeight="medium">{text}</Text>
            <Flex mt={2} gap={2} justify="flex-end">
              <Popover.CloseTrigger asChild>
                <Button variant="surface" size="2xs">
                  Cancel
                </Button>
              </Popover.CloseTrigger>
              <Button variant="surface" size="2xs" colorPalette="red" onClick={() => onDelete()} loading={isLoading}>
                Delete
              </Button>
            </Flex>
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
};
