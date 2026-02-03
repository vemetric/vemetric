import type { BoxProps, CardRootProps, FlexProps } from '@chakra-ui/react';
import { Box, Card, Flex, HStack, Icon, IconButton, Spinner, Text } from '@chakra-ui/react';
import type { LinkProps } from '@tanstack/react-router';
import { Link, useMatches, useNavigate, useParams } from '@tanstack/react-router';
import type { ElementType } from 'react';
import { useState } from 'react';
import {
  TbDeviceAnalytics,
  TbChartFunnel,
  TbMessageCircleQuestion,
  TbStack2,
  TbTool,
  TbUserSquareRounded,
  TbDotsVertical,
  TbLogout,
  TbSettings,
} from 'react-icons/tb';
import { useAccountSettingsDialog } from '@/hooks/use-account-settings-dialog';
import { useOpenCrispChat } from '@/stores/crisp-chat-store';
import { authClient, useLogout } from '@/utils/auth';
import { AccountAvatar } from './account-avatar';
import { EventLimitBanner } from './event-limit-banner';
import { SocialButtons } from './social-buttons';
import { ThemeSwitch } from './theme-switch';
import { UserMenu } from './user-menu';

interface NavigationItemProps extends FlexProps {
  icon: ElementType;
  to?: LinkProps['to'];
  params?: LinkProps['params'];
  search?: LinkProps['search'];
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
  const navigate = useNavigate();
  const { open: openAccountSettings } = useAccountSettingsDialog();
  const matches = useMatches();
  const { data: session } = authClient.useSession();
  const { user } = session ?? {};
  const { logout } = useLogout();
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
        isActive={routeId.startsWith('/_layout/p/$projectId/funnels/')}
        icon={TbChartFunnel}
        as={Link}
        to="/p/$projectId/funnels"
        params={{ projectId }}
      >
        Funnels
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
        isActive={routeId === '/_layout/p/$projectId/settings/'}
        icon={TbTool}
        as={Link}
        to="/p/$projectId/settings"
        params={{ projectId }}
      >
        Settings
      </NavigationItem>
      <NavDivider />
      <Box h={{ base: '30px', md: '30px', lg: '100px' }} />
      <Flex p={2} align="flex-end" justify="center" gap={2}>
        <SocialButtons />
      </Flex>
      <EventLimitBanner />
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
        as="button"
        cursor="pointer"
        hideFrom="lg"
        icon={TbSettings}
        onClick={() => openAccountSettings()}
      >
        Account
      </NavigationItem>
      <NavigationItem
        as="button"
        cursor="pointer"
        hideFrom="lg"
        icon={isLogoutLoading ? Spinner : TbLogout}
        onClick={async () => {
          if (isLogoutLoading) {
            return;
          }

          setIsLogoutLoading(true);
          await logout();
          navigate({ to: '/login' });
        }}
      >
        Logout
      </NavigationItem>
      <UserMenu asChild hideBelow="lg">
        <HStack
          role="button"
          gap="3"
          mt="1.5"
          pl="2"
          mx="1"
          py="1.5"
          justify="space-between"
          align="center"
          cursor="pointer"
          rounded="md"
          border="1px solid transparent"
          transition="all 0.2s ease-in-out"
          _hover={{ bg: 'gray.subtle', borderColor: 'gray.muted' }}
        >
          <HStack gap="3">
            <AccountAvatar />
            <Box>
              <Text textStyle="sm" fontWeight="medium" lineClamp={1}>
                {user?.name || 'Unknown'}
              </Text>
              <Text textStyle="sm" color="fg.muted">
                Account
              </Text>
            </Box>
          </HStack>
          <IconButton as="div" p={1.5} h="auto" minW="0px" variant="ghost" colorPalette="gray" aria-label="Open Menu">
            <TbDotsVertical />
          </IconButton>
        </HStack>
      </UserMenu>
    </Card.Root>
  );
};
