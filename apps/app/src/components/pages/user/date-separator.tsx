import { Box, Flex, Tag } from '@chakra-ui/react';

interface Props {
  children: React.ReactNode;
}

export const DateSeparator = ({ children }: Props) => {
  return (
    <Flex justify="center" align="center" bg="bg.content">
      <Box
        h="1px"
        flexGrow={1}
        bg="linear-gradient(to right, rgba(0,0,0,0) 0%, var(--chakra-colors-gray-emphasized) 100%)"
        opacity={0.7}
      />
      <Tag.Root size="xl" rounded="md" py={1} px={2} h="auto">
        <Tag.Label display="flex" alignItems="center">
          {children}
        </Tag.Label>
      </Tag.Root>
      <Box
        h="1px"
        flexGrow={1}
        bg="linear-gradient(to left, rgba(0,0,0,0) 0%, var(--chakra-colors-gray-emphasized) 100%)"
        opacity={0.7}
      />
    </Flex>
  );
};
