import { Card, Flex, Text, Link } from '@chakra-ui/react';
import {} from '@tanstack/react-router';
import { TbFlagCode } from 'react-icons/tb';
import { CardIcon } from '~/components/card-icon';
import { IntegrationGuides } from '~/components/integration-guides';

export const InstallationCard = () => {
  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <CardIcon>
            <TbFlagCode />
          </CardIcon>
          <Text fontWeight="semibold">Installation</Text>
        </Flex>
      </Card.Header>
      <Card.Body p={4} pb={3}>
        <Text mb={3} opacity={0.9}>
          We&apos;ve prepared the following guides to help you integrate Vemetric:
        </Text>
        <IntegrationGuides />
        <Text opacity={0.85} mt={4} fontSize="sm" pl="1">
          Checkout the{' '}
          <Link color="purple.fg" fontWeight="medium" href="https://vemetric.com/docs/installation">
            installation docs
          </Link>{' '}
          for more information.
        </Text>
        <Text opacity={0.85} mt={1.5} fontSize="sm" pl="1">
          Hint: we recommend{' '}
          <Link color="purple.fg" fontWeight="medium" href="https://vemetric.com/docs/advanced-guides/using-a-proxy">
            using a proxy
          </Link>{' '}
          to send events via your own domain.
        </Text>
      </Card.Body>
    </Card.Root>
  );
};
