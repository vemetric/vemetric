import { Flex, Tabs, Text } from '@chakra-ui/react';
import { useEffect } from 'react';
import { TbCreditCard, TbSettings, TbUsers } from 'react-icons/tb';
import { useOrgSettingsDialog } from '@/hooks/use-org-settings-dialog';
import { OrganizationIcon } from './organization-icon';
import { BillingTab } from './pages/settings/organization/billing/billing-tab';
import { OrganizationGeneralTab } from './pages/settings/organization/general-tab';
import { OrganizationMembersTab } from './pages/settings/organization/members/members-tab';
import { DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogCloseTrigger } from './ui/dialog';
import { toaster } from './ui/toaster';

export const OrganizationSettingsDialog = () => {
  const { isPending, isOpen, tab, organizationId, currentOrganization, isAdmin, isOnboarded, close, setTab } =
    useOrgSettingsDialog();

  useEffect(() => {
    if (!isOpen || isPending) return;

    if (!isOnboarded) {
      close();
      toaster.create({
        title: 'Organization not onboarded',
        description: 'Please complete the onboarding process before accessing settings.',
        type: 'error',
      });
      return;
    }

    if (!isAdmin) {
      close();
      toaster.create({
        title: 'Access denied',
        description: 'Only organization admins can access settings.',
        type: 'error',
      });
      return;
    }
  }, [isPending, isAdmin, isOpen, isOnboarded, close]);

  if (!organizationId || !isAdmin || !isOnboarded) {
    return null;
  }

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={({ open }) => {
        if (!open) close();
      }}
      size="lg"
      scrollBehavior="inside"
    >
      <DialogContent maxW="600px" bg="gray.subtle">
        <DialogHeader pt={4} pb={2}>
          <DialogTitle display="flex" alignItems="center" gap="5">
            Organization Settings
            {currentOrganization && (
              <Flex align="center" gap={2} px={1.5} py={1} bg="gray.subtle" rounded="md" fontSize="md">
                <OrganizationIcon />
                <Text textAlign="left" fontWeight="medium" lineClamp={1}>
                  {currentOrganization.name}
                </Text>
              </Flex>
            )}
          </DialogTitle>
        </DialogHeader>
        <DialogBody p={0} pt={2} m="1px" bg="gray.subtle" rounded="md" overflow="hidden">
          <Tabs.Root
            value={tab}
            onValueChange={({ value }) => setTab(value as 'general' | 'billing' | 'members')}
            variant="outline"
            css={{
              '& > [data-part="content"]': {
                border: 'none',
                rounded: 'none',
                overflowY: 'auto',
                maxH: '600px',
                bg: 'bg',
              },
            }}
          >
            <Tabs.List bg="gray.subtle" _before={{ rounded: 'none' }} css={{ '& > [data-selected]': { bg: 'bg' } }}>
              <Tabs.Trigger value="general">
                <TbSettings />
                General
              </Tabs.Trigger>
              <Tabs.Trigger value="billing">
                <TbCreditCard />
                Billing & Usage
              </Tabs.Trigger>
              <Tabs.Trigger value="members">
                <TbUsers />
                Members
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="general">
              <OrganizationGeneralTab organizationId={organizationId} />
            </Tabs.Content>
            <Tabs.Content value="billing">
              <BillingTab organizationId={organizationId} />
            </Tabs.Content>
            <Tabs.Content value="members">
              <OrganizationMembersTab organizationId={organizationId} />
            </Tabs.Content>
          </Tabs.Root>
        </DialogBody>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
