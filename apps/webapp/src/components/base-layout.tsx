import { Flex, Link, Box } from '@chakra-ui/react';
import { vemetric } from '@vemetric/react';
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
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);

  return (
    <PageWrapper flexDir="column" px={{ base: 2, md: 5 }} pt={{ base: 2, md: 4 }}>
      <Flex align="center" justify="space-between">
        <Flex justify="center" w={{ base: 'auto', lg: '190px' }}>
          <Logo h={{ base: '32px', md: '44px' }} />
        </Flex>
        <Flex align="center" gap="4">
          <ThemeSwitch />
          <Box w="1px" h="20px" bg="border.emphasized" />
          <Link
            as="button"
            textStyle="sm"
            onClick={() => {
              if (isLogoutLoading) {
                return;
              }

              authClient.signOut({
                fetchOptions: {
                  onRequest: () => {
                    setIsLogoutLoading(true);
                  },
                  onSuccess: async () => {
                    await vemetric.resetUser();
                  },
                },
              });
            }}
          >
            Logout
          </Link>
        </Flex>
      </Flex>
      {children}
    </PageWrapper>
  );
};
