import type { BoxProps, CardRootProps, FlexProps } from '@chakra-ui/react';
import { Box, Card, Flex, Icon, Spinner } from '@chakra-ui/react';
import type { LinkProps } from '@tanstack/react-router';
import { Link, useMatches, useParams } from '@tanstack/react-router';
import { vemetric } from '@vemetric/react';
import type { ElementType } from 'react';
import { useState } from 'react';
import {
  TbDeviceAnalytics,
  TbChartFunnel,
  TbLogout,
  TbMessageCircleQuestion,
  TbStack2,
  TbTool,
  TbUserSquareRounded,
} from 'react-icons/tb';
import { useOpenCrispChat } from '@/stores/crisp-chat-store';
import { authClient } from '@/utils/auth';
import { SocialButtons } from './social-buttons';
import { ThemeSwitch } from './theme-switch';

interface NavigationItemProps extends FlexProps {
  icon: ElementType;
  to?: LinkProps['to'];
  params?: LinkProps['params'];
  isActive?: boolean;
}

export const NavigationItem = ({ icon, children, isActive, ...props }: NavigationItemProps) => {
  return (
    <Flex
      align="center"
      gap={2.5}
      fontWeight={500}
      fontSize="17px"
      px={4}
      py={3}
      transition="all 0.3s ease-out"
      _hover={{ transform: 'translateX(3px)', transition: 'all 0.2s ease-out' }}
      _active={{ transform: 'translateX(0)' }}
      color={isActive ? 'purple.fg' : undefined}
      {...props}
    >
      <Icon as={icon} width={5} height={5} />
      {children}
    </Flex>
  );
};

export const NavDivider = (props: BoxProps) => (
  <Box
    w="100%"
    h="1px"
    opacity={0.25}
    bg="linear-gradient(to right, rgba(209, 136, 255, 0.2), rgb(164, 119, 255), rgba(229, 136, 255, 0.2))"
    {...props}
  />
);

export const Navigation = (props: CardRootProps) => {
  const matches = useMatches();
  const routeId = matches[matches.length - 1].routeId;

  const openCrispChat = useOpenCrispChat();

  const [isLogoutLoading, setIsLogoutLoading] = useState(false);
  const params = useParams({ strict: false });
  const projectId = 'projectId' in params ? params.projectId : null;

  if (projectId === null) {
    throw new Error('projectId not found');
  }

  return (
    <Card.Root py={1} pos="relative" rounded="lg" minW="190px" {...props}>
      <NavigationItem
        isActive={routeId === '/_layout/p/$projectId/'}
        icon={TbDeviceAnalytics}
        as={Link}
        to="/p/$projectId"
        params={{ projectId }}
      >
        Dashboard
      </NavigationItem>
      <NavigationItem
        isActive={routeId.startsWith('/_layout/p/$projectId/users/')}
        icon={TbUserSquareRounded}
        as={Link}
        to="/p/$projectId/users"
        params={{ projectId }}
      >
        Users
      </NavigationItem>
      <NavigationItem
        isActive={routeId.startsWith('/_layout/p/$projectId/events/')}
        icon={TbStack2}
        as={Link}
        to="/p/$projectId/events"
        params={{ projectId }}
      >
        Events
      </NavigationItem>
      <NavigationItem
        isActive={routeId.startsWith('/_layout/p/$projectId/funnels/')}
        icon={TbChartFunnel}
        as={Link}
        to="/p/$projectId/funnels"
        params={{ projectId }}
      >
        Funnels
      </NavigationItem>
      <NavDivider />
      <Box h={{ base: '30px', md: '30px', lg: '100px' }} />
      <Flex p={2} align="flex-end" justify="center" gap={2}>
        <SocialButtons />
      </Flex>
      <Flex justify="center" p={2}>
        <ThemeSwitch />
      </Flex>
      <NavDivider />
      <NavigationItem
        icon={TbMessageCircleQuestion}
        as="button"
        onClick={() => {
          openCrispChat();
        }}
        hideFrom="lg"
      >
        Help
      </NavigationItem>
      <NavigationItem
        isActive={routeId === '/_layout/p/$projectId/settings/'}
        icon={TbTool}
        as={Link}
        to="/p/$projectId/settings"
        params={{ projectId }}
      >
        Settings
      </NavigationItem>
      <NavigationItem
        as="button"
        cursor="pointer"
        icon={isLogoutLoading ? Spinner : TbLogout}
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
      </NavigationItem>
    </Card.Root>
  );
};
