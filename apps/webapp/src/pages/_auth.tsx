import { Box, Container, Flex, Stack, Link } from '@chakra-ui/react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AnimatePresence } from 'motion/react';
import { AuthIllustration } from '@/components/auth-illustration';
import { Logo } from '@/components/logo';

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
