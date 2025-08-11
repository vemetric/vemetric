import type { IconButtonProps } from '@chakra-ui/react';
import { Flex, SimpleGrid, IconButton, VisuallyHidden } from '@chakra-ui/react';
import { Link, useMatches, useParams } from '@tanstack/react-router';
import { useState, forwardRef } from 'react';
import { TbUserSquareRounded, TbDeviceAnalytics, TbMenu2, TbChartFunnel } from 'react-icons/tb';
import { Drawer } from 'vaul';
import { Navigation } from './navigation';

interface MenuButtonProps extends IconButtonProps {
  label: string;
  isActive?: boolean;
}
// eslint-disable-next-line react/display-name
const MenuButton = forwardRef<HTMLButtonElement, MenuButtonProps>(({ label, isActive = false, ...props }, ref) => (
  <IconButton variant="ghost" aria-label={label} color={isActive ? 'purple.fg' : undefined} {...props} ref={ref} />
));

export const MobileMenu = () => {
  const [open, setOpen] = useState(false);
  const matches = useMatches();
  const routeId = matches[matches.length - 1].routeId;

  const params = useParams({ strict: false });
  const projectId = 'projectId' in params ? params.projectId : -1;

  if (projectId === -1 || !projectId) {
    throw new Error('projectId not found');
  }

  return (
    <Flex display={{ base: 'flex', md: 'none' }} position="sticky" bottom="0px" zIndex="sticky">
      <SimpleGrid
        columns={4}
        borderTop="1px solid"
        borderColor="gray.emphasized"
        bg="bg.card"
        boxShadow="lg"
        w="100%"
        p={3}
        pb="calc(max(env(safe-area-inset-bottom), var(--chakra-spacing-3)) + 0px)"
        transition="padding 0.2s ease-in-out"
      >
        <MenuButton asChild label="Dashboard" isActive={routeId === '/_layout/p/$projectId/'}>
          <Link to="/p/$projectId" params={{ projectId }}>
            <TbDeviceAnalytics />
          </Link>
        </MenuButton>
        <MenuButton asChild label="Users" isActive={routeId.startsWith('/_layout/p/$projectId/users/')}>
          <Link to="/p/$projectId/users" params={{ projectId }}>
            <TbUserSquareRounded />
          </Link>
        </MenuButton>
        <MenuButton asChild label="Funnels" isActive={routeId === '/_layout/p/$projectId/funnels/'}>
          <Link to="/p/$projectId/funnels" params={{ projectId }}>
            <TbChartFunnel />
          </Link>
        </MenuButton>
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Trigger asChild>
            <MenuButton label="More">
              <TbMenu2 />
            </MenuButton>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="vault-overlay" />
            <Drawer.Content
              className="vault-content"
              onClick={(e) => {
                if (e.target instanceof HTMLElement && e.target.tagName === 'A') {
                  setOpen(false);
                }
              }}
            >
              <Drawer.Handle />
              <VisuallyHidden>
                <Drawer.Title>Mobile Menu</Drawer.Title>
                <Drawer.Description></Drawer.Description>
              </VisuallyHidden>
              <Navigation border="none" boxShadow="none" p={0} outline="none" />
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </SimpleGrid>
    </Flex>
  );
};
