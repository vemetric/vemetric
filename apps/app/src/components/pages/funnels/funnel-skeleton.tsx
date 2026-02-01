import { Box, Flex, Icon } from '@chakra-ui/react';

export const FunnelSkeleton = () => {
  return (
    <Flex pos="relative" justify="center" pt={16} animation="pulse 2s infinite">
      <Flex align="flex-end" borderBottom="2px solid" borderColor="gray.emphasized" px="4">
        <Box zIndex="1" h="200px" w="100px" borderTopRadius="xl" bg="gray.emphasized" />
        <Box opacity={0.5}>
          <Icon
            as="svg"
            width="50px"
            height="195px"
            viewBox="0 0 50 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            mx="-0.5"
          >
            <path d={`M0 0 L50 60 L50 200 L0 200 Z`} fill="var(--chakra-colors-gray-emphasized)" />
          </Icon>
        </Box>
        <Box zIndex="1" h="140px" w="100px" borderTopRadius="xl" bg="gray.emphasized" />
        <Box opacity={0.5}>
          <Icon
            as="svg"
            width="50px"
            height="195px"
            viewBox="0 0 50 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            mx="-0.5"
          >
            <path d={`M0 60 L50 130 L50 200 L0 200 Z`} fill="var(--chakra-colors-gray-emphasized)" />
          </Icon>
        </Box>
        <Box zIndex="1" h="70px" w="100px" borderTopRadius="xl" bg="gray.emphasized" />
      </Flex>
    </Flex>
  );
};
