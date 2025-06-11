import { Box, Container, Text, Flex, HStack, Stack, Link, Avatar, Card } from '@chakra-ui/react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AnimatePresence } from 'motion/react';
import { TbMessage2 } from 'react-icons/tb';
import { AuthIllustration } from '@/components/auth-illustration';
import { CrispLink } from '@/components/crisp-link';
import { Logo } from '@/components/logo';

export const ContactCard = () => {
  return (
    <Card.Root size="sm" mt="5">
      <Card.Body>
        <HStack textStyle="sm">
          <Avatar.Root size="xs">
            <Avatar.Fallback />
            <Avatar.Image src="/images/avatar/dominik2.jpg" />
          </Avatar.Root>
          <Text>Do you have any questions?</Text>
          <CrispLink fontWeight="semibold">
            <TbMessage2 />
            Contact me
          </CrispLink>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};

export const Route = createFileRoute('/_auth')({
  component: RouteComponent,
});

const hostname = location.hostname.split('.').slice(-2).join('.');

function RouteComponent() {
  return (
    <Flex height="100dvh" flex="1">
      <Box flex="1" overflow="auto" h="100%">
        <Flex minH="100%" flexDir="column" justify="center" py={6}>
          <Container maxW="md">
            <Stack gap="7">
              <Flex justify="center">
                <Link href={`https://${hostname}`}>
                  <Logo asLink={false} h="60px" />
                </Link>
              </Flex>

              <AnimatePresence>
                <Outlet />
              </AnimatePresence>

              <ContactCard />
            </Stack>
          </Container>
        </Flex>
      </Box>
      <Box flex="1.5" hideBelow="lg" pos="relative">
        <AuthIllustration />
      </Box>
    </Flex>
  );
}
