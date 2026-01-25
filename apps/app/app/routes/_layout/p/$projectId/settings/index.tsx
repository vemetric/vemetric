import { Button, Tabs, Text } from '@chakra-ui/react';
import { useNavigate, createFileRoute } from '@tanstack/react-router';
import { fallback, zodValidator } from '@tanstack/zod-adapter';
import { TbSettings, TbCreditCard } from 'react-icons/tb';
import { z } from 'zod';
import { ProjectGeneralTab } from '~/components/pages/settings/project/general-tab';
import { EmptyState } from '~/components/ui/empty-state';
import { useOrgSettingsDialog } from '~/hooks/use-org-settings-dialog';
import { useSetBreadcrumbs } from '~/stores/header-store';

const settingsSearchSchema = z.object({
  tab: fallback(z.enum(['general', 'billing']), 'general').default('general'),
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

  const { open } = useOrgSettingsDialog();

  return (
    <Tabs.Root
      value={tab}
      onValueChange={({ value }) => {
        navigate({ resetScroll: false, search: { tab: value as 'general' | 'billing' } });
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
      </Tabs.List>
      <Tabs.Content value="general">
        <ProjectGeneralTab projectId={projectId} />
      </Tabs.Content>
      <Tabs.Content value="billing">
        <EmptyState
          icon={<TbCreditCard size={64} />}
          title="Billing & Usage is managed at the organization level"
          description={
            <>
              <Text mb="1">Usage is shared across all projects within the organization.</Text>
              <Text>Head to Organization Settings to manage billing details.</Text>
            </>
          }
        >
          <Button onClick={() => open('billing')}>
            <TbSettings /> Open Organization Settings
          </Button>
        </EmptyState>
      </Tabs.Content>
    </Tabs.Root>
  );
}
