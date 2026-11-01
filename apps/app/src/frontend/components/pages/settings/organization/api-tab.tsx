import { Badge, Box, Button, Flex, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { TbPlus, TbShieldLock } from 'react-icons/tb';
import { DocsButton } from '@/components/docs-button';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import type { OrganizationApiKeyItem } from '@/utils/trpc';
import { trpc } from '@/utils/trpc';
import { CreateApiKeyDialog } from './create-api-key-dialog';
import { ApiKeysCard } from '../api-keys/api-keys-card';
import { NewApiKeyDialog } from '../api-keys/new-api-key-dialog';
import { RevokeApiKeyDialog } from '../api-keys/revoke-api-key-dialog';

const KeyProjectsBadge = ({ apiKey }: { apiKey: OrganizationApiKeyItem }) => {
  if (apiKey.allProjects) {
    return (
      <Badge size="xs" variant="subtle" colorPalette="green">
        All projects
      </Badge>
    );
  }

  if (apiKey.projects.length === 0) {
    return (
      <Tooltip content="All chosen projects were deleted, so this key can't access any data.">
        <Badge size="xs" variant="subtle" colorPalette="red" cursor="help">
          No projects
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      content={
        <Box py={1}>
          {apiKey.projects.map((project) => (
            <Text key={project.id} fontSize="xs">
              {project.name}
            </Text>
          ))}
        </Box>
      }
    >
      <Badge size="xs" variant="subtle" colorPalette="orange" cursor="help">
        <TbShieldLock />
        {apiKey.projects.length === 1 ? '1 project' : `${apiKey.projects.length} projects`}
      </Badge>
    </Tooltip>
  );
};

interface Props {
  organizationId: string;
}

export const OrganizationApiTab = ({ organizationId }: Props) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<OrganizationApiKeyItem | null>(null);

  const { data, refetch, isLoading } = trpc.apiKeys.listOrganizationKeys.useQuery({ organizationId });

  const { mutate: revokeKey, isPending: isRevoking } = trpc.apiKeys.revokeOrganizationKey.useMutation({
    onSuccess: async () => {
      toaster.create({
        title: 'API key revoked',
        type: 'success',
      });
      setKeyToRevoke(null);
      await refetch();
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  return (
    <Flex flexDir="column" gap={4} p={{ base: 3, md: 4 }}>
      <Flex align="flex-start" gap={3}>
        <Text fontSize="sm" color="fg.muted" flex={1}>
          Organization API keys can access all current and future projects of the organization, or only the projects you
          choose. Requests name the project in the <code>X-Vemetric-Project</code> header. For a single project, you can
          also create a project API key in the project settings.
        </Text>
        <DocsButton href="https://vemetric.com/docs/api" text="API Docs" />
      </Flex>

      <ApiKeysCard
        keys={data ?? []}
        isLoading={isLoading}
        emptyTitle="No organization API keys yet."
        onRevoke={setKeyToRevoke}
        extraColumn={{ header: 'Projects', render: (key) => <KeyProjectsBadge apiKey={key} /> }}
        headerAction={
          <Button size="xs" onClick={() => setIsCreateDialogOpen(true)}>
            <TbPlus />
            Create API Key
          </Button>
        }
      />

      {isCreateDialogOpen && (
        <CreateApiKeyDialog
          organizationId={organizationId}
          onClose={() => setIsCreateDialogOpen(false)}
          onCreated={async (rawKey) => {
            setIsCreateDialogOpen(false);
            setNewKey(rawKey);
            await refetch();
          }}
        />
      )}

      <NewApiKeyDialog rawKey={newKey} onClose={() => setNewKey(null)} />

      <RevokeApiKeyDialog
        keyName={keyToRevoke?.name ?? null}
        isRevoking={isRevoking}
        onClose={() => setKeyToRevoke(null)}
        onRevoke={() => {
          if (!keyToRevoke) {
            return;
          }

          revokeKey({ organizationId, keyId: keyToRevoke.id });
        }}
      />
    </Flex>
  );
};
