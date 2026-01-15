import { Center, Flex, IconButton, Span, Spinner, Text } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TbLogout, TbMenu2 } from 'react-icons/tb';
import { useLogout } from '@/utils/auth';
import { ThemeSwitch } from './theme-switch';
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from './ui/menu';

export const UserMenu = () => {
  const navigate = useNavigate();
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
      <MenuTrigger asChild>
        <IconButton variant={{ base: 'ghost', md: 'surface' }} aria-label="Menu">
          <TbMenu2 size="24px" />
        </IconButton>
      </MenuTrigger>
      <MenuContent minW="160px">
        <Flex justify="center" p={2}>
          <ThemeSwitch />
        </Flex>
        <MenuSeparator my="0" />
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
