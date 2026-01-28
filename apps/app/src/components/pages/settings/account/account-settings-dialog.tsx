import { Tabs } from '@chakra-ui/react';
import { TbSettings, TbShieldLock } from 'react-icons/tb';
import { useAccountSettingsDialog } from '@/hooks/use-account-settings-dialog';
import { AccountAuthenticationTab } from './auth-tab';
import { AccountGeneralTab } from './general-tab';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from '../../../ui/dialog';

export const AccountSettingsDialog = () => {
  const { isOpen, close, tab, setTab } = useAccountSettingsDialog();

  if (!isOpen) {
    return null;
  }

  return (
    <DialogRoot
      open
      onOpenChange={({ open }) => {
        if (!open) close();
      }}
      size={{ mdDown: 'full', md: 'lg' }}
      scrollBehavior="inside"
    >
      <DialogContent maxW={{ base: 'none', md: '600px' }} bg="gray.subtle">
        <DialogHeader pt={4} pb={2} px={{ base: 3, md: 6 }}>
          <DialogTitle
            display="flex"
            flexDirection={{ base: 'column', md: 'row' }}
            alignItems={{ base: 'flex-start', md: 'center' }}
            gap={{ base: 2, md: 5 }}
            fontSize={{ base: 'md', md: 'lg' }}
          >
            Account Settings
          </DialogTitle>
        </DialogHeader>
        <DialogBody p={0} pt={2} m="1px" bg="gray.subtle" rounded="md" overflow="hidden">
          <Tabs.Root
            value={tab ?? 'general'}
            onValueChange={({ value }) => setTab(value as 'general' | 'auth')}
            variant="outline"
            css={{
              '& > [data-part="content"]': {
                border: 'none',
                rounded: 'none',
                overflowY: 'auto',
                minH: { base: 'calc(100vh - 150px)', md: '0px' },
                maxH: { base: 'calc(100vh - 150px)', md: '600px' },
                bg: 'bg',
              },
            }}
          >
            <Tabs.List bg="gray.subtle" _before={{ rounded: 'none' }} css={{ '& > [data-selected]': { bg: 'bg' } }}>
              <Tabs.Trigger value="general">
                <TbSettings />
                General
              </Tabs.Trigger>
              <Tabs.Trigger value="auth">
                <TbShieldLock />
                Authentication
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="general">
              <AccountGeneralTab />
            </Tabs.Content>
            <Tabs.Content value="auth">
              <AccountAuthenticationTab />
            </Tabs.Content>
          </Tabs.Root>
        </DialogBody>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
