import type { MenuTriggerProps } from '@chakra-ui/react';
import { Center, Flex, Span, Spinner, Text } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TbLogout, TbSettings } from 'react-icons/tb';
import { useAccountSettingsDialog } from '~/hooks/use-account-settings-dialog';
import { useLogout } from '~/utils/auth';
import { ThemeSwitch } from './theme-switch';
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from './ui/menu';

interface Props extends MenuTriggerProps {
  showThemeSwitch?: boolean;
}

export const UserMenu = ({ showThemeSwitch = false, ...props }: Props) => {
  const navigate = useNavigate();
  const { open: openAccountSettings } = useAccountSettingsDialog();
  const [isLogoutLoading, setIsLogoutLoading] = useState(false);
  const { logout } = useLogout();

  const handleLogout = async () => {
    if (isLogoutLoading) return;

    setIsLogoutLoading(true);
    await logout();
    navigate({ to: '/login' });
  };

  return (
    <MenuRoot>
      <MenuTrigger {...props} />
      <MenuContent minW="140px">
        {showThemeSwitch && (
          <>
            <Flex justify="center" p={2}>
              <ThemeSwitch />
            </Flex>
            <MenuSeparator my="0" />
          </>
        )}
        <MenuItem value="settings" py={2} onClick={() => openAccountSettings()}>
          <Flex align="center" gap={2} pos="relative">
            <TbSettings />
            <Text>Settings</Text>
          </Flex>
        </MenuItem>
        <MenuItem value="logout" py={2} onClick={handleLogout}>
          <Flex align="center" gap={2} pos="relative">
            <Span opacity={isLogoutLoading ? 0 : 1}>
              <TbLogout />
            </Span>
            {isLogoutLoading && (
              <Center pos="absolute" left="0">
                <Spinner size="xs" />
              </Center>
            )}
            <Text>Logout</Text>
          </Flex>
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
};
