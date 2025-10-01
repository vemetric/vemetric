import { Flex, Link, Box, Center, Spinner, Span } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { authClient } from '@/utils/auth';
import { Logo } from './logo';
import { PageWrapper } from './page-wrapper';
import { ThemeSwitch } from './theme-switch';

interface Props {
  children: React.ReactNode;
}

export const BaseLayout = (props: Props) => {
  const { children } = props;
  const navigate = useNavigate();
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);

  return (
    <>
      <Flex
        align="center"
        justify="space-between"
        bg={{ base: 'bg.card', md: 'none' }}
        px={{ base: 2, md: 5 }}
        pt={{ base: 2, md: 4 }}
        pb={{ base: 2, md: 0 }}
        borderBottom={{ base: '1px solid', md: 'none' }}
        borderColor="border.emphasized"
      >
        <Flex justify="center" w={{ base: 'auto', lg: '190px' }}>
          <Logo h={{ base: '32px', md: '44px' }} />
        </Flex>
        <Flex align="center" gap="4">
          <ThemeSwitch />
          <Box w="1px" h="20px" bg="border.emphasized" />
          <Link
            as="button"
            pos="relative"
            textStyle="sm"
            onClick={async () => {
              if (isLogoutLoading) {
                return;
              }

              setIsLogoutLoading(true);
              await authClient.signOut();
              navigate({ to: '/login' });
            }}
          >
            <Span opacity={isLogoutLoading ? 0.5 : 1}>Logout</Span>
            {isLogoutLoading && (
              <Center pos="absolute" top="0" left="0" w="100%" h="100%">
                <Spinner size="xs" />
              </Center>
            )}
          </Link>
        </Flex>
      </Flex>
      <PageWrapper flexDir="column">{children}</PageWrapper>
    </>
  );
};
