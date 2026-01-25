import { Icon, Card, Flex, Text, LinkOverlay } from '@chakra-ui/react';
import { TbChevronRight } from 'react-icons/tb';

interface Props {
  icon?: React.ElementType;
  title: string;
  description: string;
  href: string;
}

export const DocsCard = ({ icon, title, description, href }: Props) => {
  return (
    <Card.Root
      position="relative"
      w="full"
      overflow="hidden"
      p={3.5}
      rounded="lg"
      transition="all 0.2s ease-in-out"
      _hover={{
        bg: 'gray.100',
        borderColor: 'purple.300',
        _dark: {
          bg: 'gray.800',
          borderColor: 'purple.500',
        },
      }}
      className="group"
    >
      <Flex
        align="center"
        fontWeight="medium"
        fontSize="md"
        mb={2}
        whiteSpace="nowrap"
        transition="all 0.2s ease-in-out"
        _groupHover={{
          color: 'purple.600',
          _dark: {
            color: 'purple.400',
          },
        }}
      >
        {icon && <Icon as={icon} mr={1.5} boxSize="16px" />}
        <LinkOverlay
          href={href}
          target="_blank"
          m="0!important"
          p="0!important"
          textOverflow="ellipsis"
          overflow="hidden"
          color="gray.fg"
          bg="transparent"
          transition="all 0.2s ease-in-out"
          _groupHover={{
            color: 'purple.600',
            _dark: {
              color: 'purple.400',
            },
          }}
          _hover={{
            textDecoration: 'none',
          }}
        >
          <Text as="span" mr={1}>
            {title}
          </Text>
        </LinkOverlay>
        <Icon as={TbChevronRight} mt="1px" boxSize="15px" />
      </Flex>
      <Text fontSize="sm" color="gray.500">
        {description}
      </Text>
    </Card.Root>
  );
};
