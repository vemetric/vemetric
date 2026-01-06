import { Tabs } from '@chakra-ui/react';
import { useNavigate, createFileRoute } from '@tanstack/react-router';
import { fallback, zodValidator } from '@tanstack/zod-adapter';
import { TbSettings, TbCreditCard, TbKey } from 'react-icons/tb';
import { z } from 'zod';
import { ApiKeysCard } from '@/components/pages/settings/api-keys-card';
import { BillingTab } from '@/components/pages/settings/billing/billing-tab';
import { GeneralTab } from '@/components/pages/settings/general-tab';
import { useSetBreadcrumbs } from '@/stores/header-store';

const settingsSearchSchema = z.object({
  tab: fallback(z.enum(['general', 'billing', 'api-keys']), 'general').default('general'),
  pricingDialog: z.boolean().optional(),
});

export const Route = createFileRoute('/_layout/p/$projectId/settings/')({
  validateSearch: zodValidator(settingsSearchSchema),
  component: Page,
});

function Page() {
  const { projectId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: '/p/$projectId/settings' });
  useSetBreadcrumbs(['Settings']);

  return (
    <Tabs.Root
      value={tab}
      onValueChange={({ value }) => {
        navigate({ resetScroll: false, search: { tab: value as 'general' | 'billing' | 'api-keys' } });
      }}
      variant="outline"
      maxW="600px"
    >
      <Tabs.List>
        <Tabs.Trigger value="general">
          <TbSettings />
          General
        </Tabs.Trigger>
        <Tabs.Trigger value="billing">
          <TbCreditCard />
          Billing & Usage
        </Tabs.Trigger>
        <Tabs.Trigger value="api-keys">
          <TbKey />
          API Keys
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="general">
        <GeneralTab projectId={projectId} />
      </Tabs.Content>
      <Tabs.Content value="billing">
        <BillingTab projectId={projectId} />
      </Tabs.Content>
      <Tabs.Content value="api-keys">
        <ApiKeysCard projectId={projectId} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
