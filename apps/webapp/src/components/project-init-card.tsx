import { Card, Box, Flex, Text, AbsoluteCenter, Icon, Alert, Link } from '@chakra-ui/react';
import { TbActivity, TbKey } from 'react-icons/tb';
import { CodeBox } from './code-box';
import { IntegrationGuides } from './integration-guides';

interface Props {
  projectToken: string;
}

export function ProjectInitCard(props: Props) {
  return (
    <AbsoluteCenter
      zIndex="5"
      bg="blackAlpha.500/70"
      boxSize="100%"
      p={4}
      pt={14}
      alignItems="flex-start"
      _dark={{ bg: 'blackAlpha.700' }}
      overflow="auto"
      roundedBottom="lg"
    >
      <Card.Root p={4} mb={2} maxW="650px" border="1px solid" borderColor="gray.emphasized">
        <Flex direction="column" align="center" textAlign="center" gap={2}>
          <Box pos="relative">
            <Icon
              asChild
              boxSize="64px"
              color="purple.solid"
              pos="absolute"
              transform="scale(1.15)"
              opacity={0.35}
              animationName="ping"
              animationDuration="1.5s"
              animationIterationCount="infinite"
            >
              <TbActivity />
            </Icon>
            <Icon asChild boxSize="64px" color="purple.solid">
              <TbActivity />
            </Icon>
          </Box>
          <Text fontSize="xl" fontWeight="bold">
            Start sending your first events
          </Text>
          <Text fontSize="md" opacity={0.8} maxW="400px">
            Once you&apos;ve integrated Vemetric, refresh this page to see the data. It might take a few seconds to
            appear.
          </Text>
        </Flex>

        <Flex direction="column" mt="8" mb="5">
          <CodeBox size="sm" startElement={<TbKey />} w="fit-content">
            {props.projectToken}
          </CodeBox>
          <Text fontSize="sm" mt="1" opacity={0.7}>
            This is the public token for your project.
          </Text>
        </Flex>

        <Box as="hr" mb="3" borderColor="gray.emphasized" opacity={0.5} />

        <Text opacity={0.7} mb="3">
          We&apos;ve prepared the following guides to help you integrate Vemetric:
        </Text>

        <IntegrationGuides />

        <Text opacity={0.85} mt={6} fontSize="sm" pl="1">
          Hint: we recommend{' '}
          <Link color="purple.fg" fontWeight="medium" href="https://vemetric.com/docs/advanced-guides/using-a-proxy">
            using a proxy
          </Link>{' '}
          to send events via your own domain.
        </Text>

        <Alert.Root status="info" variant="surface" mt={3}>
          <Alert.Content>
            <Alert.Description>
              <Text>
                This is all you need in order to track simple web analytics, like pageviews and outbound link clicks.
                (without using Cookies)
              </Text>
              <Text mt={1}>
                <Link
                  color="purple.fg"
                  fontWeight="medium"
                  href="https://vemetric.com/docs/product-analytics/getting-started"
                >
                  Checkout the docs
                </Link>{' '}
                for tighter integration with your product to gain more insights.
              </Text>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      </Card.Root>
    </AbsoluteCenter>
  );
}
