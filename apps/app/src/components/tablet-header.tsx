import { Flex, IconButton } from '@chakra-ui/react';
import { useState } from 'react';
import { TbMenu2 } from 'react-icons/tb';
import { Logo } from '@/components/logo';
import { Navigation } from './navigation';
import { MenuContent, MenuRoot, MenuTrigger } from './ui/menu';

export const TabletHeader = () => {
  const [open, setOpen] = useState(false);

  return (
    <Flex
      position="sticky"
      top={0}
      zIndex="sticky"
      display={{ base: 'none', md: 'flex', lg: 'none' }}
      justifyContent="space-between"
      bg="bg.muted"
      pt={4}
    >
      <Logo />
      <MenuRoot open={open} onOpenChange={({ open }) => setOpen(open)}>
        <MenuTrigger asChild>
          <IconButton variant="surface" aria-label="Menu">
            <TbMenu2 size="24px" />
          </IconButton>
        </MenuTrigger>
        <MenuContent
          zIndex="overlay!important"
          display={{ base: 'none', md: 'flex', lg: 'none' }}
          rounded="lg"
          onClick={(e) => {
            if (e.target instanceof HTMLElement && e.target.tagName === 'A') {
              setOpen(false);
            }
          }}
        >
          <Navigation />
        </MenuContent>
      </MenuRoot>
    </Flex>
  );
};
