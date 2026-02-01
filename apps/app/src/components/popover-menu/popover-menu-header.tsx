import { IconButton, Flex } from '@chakra-ui/react';
import type { PropsWithChildren, ReactNode } from 'react';
import { TbChevronLeft } from 'react-icons/tb';

interface Props {
  title: ReactNode;
  onBack?: () => void;
}

export const PopoverMenuHeader = ({ title, onBack, children }: PropsWithChildren<Props>) => {
  return (
    <Flex p={2} align="center" justify="space-between" borderBottom="1px solid" borderColor="border.emphasized/80">
      <Flex align="center" gap={2}>
        {onBack && (
          <IconButton variant="surface" size="2xs" minW="18px" h="18px" p={0} rounded="sm" onClick={onBack}>
            <TbChevronLeft />
          </IconButton>
        )}
        <Flex align="center" gap={1} textStyle="sm" fontWeight="semibold">
          {title}
        </Flex>
      </Flex>
      {children}
    </Flex>
  );
};
