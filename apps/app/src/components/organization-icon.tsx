import type { FlexProps } from '@chakra-ui/react';
import { Flex } from '@chakra-ui/react';
import { TbBuilding } from 'react-icons/tb';

export const OrganizationIcon = (props: FlexProps) => (
  <Flex
    as="span"
    flexShrink={0}
    align="center"
    justify="center"
    boxSize="24px"
    bg="purple.muted"
    rounded="md"
    color="purple.fg"
    fontSize="sm"
    {...props}
  >
    <TbBuilding />
  </Flex>
);
