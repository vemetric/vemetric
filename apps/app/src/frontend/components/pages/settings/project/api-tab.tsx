import { Box, Button, Card, Field, Flex, Input, Link, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { TbApi, TbBuilding, TbPlus } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { DocsButton } from '@/components/docs-button';
import { toaster } from '@/components/ui/toaster';
import { useOrgSettingsDialog } from '@/hooks/use-org-settings-dialog';
import type { ApiKeyItem } from '@/utils/trpc';
import { trpc } from '@/utils/trpc';
import { ApiKeysCard } from '../api-keys/api-keys-card';
import { NewApiKeyDialog } from '../api-keys/new-api-key-dialog';
import { RevokeApiKeyDialog } from '../api-keys/revoke-api-key-dialog';

interface Props {
  projectId: string;
}

export const ProjectApiTab = ({ projectId }: Props) => {
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);
  const { open: openOrgSettings } = useOrgSettingsDialog();

  const {
    data,
    refetch,
    isLoading: isLoadingKeys,
  } = trpc.apiKeys.list.useQuery({
    projectId,
  });
  const { data: organizationKeys } = trpc.apiKeys.listOrganizationKeysForProject.useQuery({ projectId });

  const { mutate: createKey, isPending: isCreating } = trpc.apiKeys.create.useMutation({
    onSuccess: async (result) => {
      setName('');
      setNewKey(result.rawKey);
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

  const { mutate: revokeKey, isPending: isRevoking } = trpc.apiKeys.revoke.useMutation({
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

  const onCreateKey = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toaster.create({
        title: 'Error',
        description: 'Please provide a key name',
        type: 'error',
      });
      return;
    }

    createKey({
      projectId,
      name: trimmedName,
    });
  };

  const organizationKeyNames = (organizationKeys ?? []).map((key) => key.name);

  return (
    <Flex flexDir="column" gap={6} maxW="900px">
      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbApi />
            </CardIcon>
            <Text fontWeight="semibold">Create new API Key</Text>
            <Box flexGrow={1} />
            <DocsButton href="https://vemetric.com/docs/api" text="API Docs" />
          </Flex>
        </Card.Header>
        <Card.Body as="form" onSubmit={onCreateKey}>
          <Flex gap={3} flexDir={{ base: 'column', md: 'row' }}>
            <Field.Root flex={1}>
              <Field.Label>Key Name</Field.Label>
              <Input
                placeholder="Enter a name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={isCreating}
              />
            </Field.Root>
            <Button alignSelf={{ base: 'flex-start', md: 'flex-end' }} type="submit" loading={isCreating}>
              <TbPlus />
              Create API Key
            </Button>
          </Flex>
          <Text fontSize="sm" color="fg.muted" mt={3}>
            API keys are scoped to this project and can only be managed by organization admins. Need one key for several
            projects?{' '}
            <Link as="button" color="purple.fg" fontWeight="medium" onClick={() => openOrgSettings('api')}>
              Create an organization API key
            </Link>
            .
          </Text>
        </Card.Body>
      </Card.Root>

      <ApiKeysCard
        keys={data ?? []}
        isLoading={isLoadingKeys}
        emptyTitle="No API keys available for this project."
        onRevoke={setKeyToRevoke}
      />

      {organizationKeyNames.length > 0 && (
        <Card.Root>
          <Card.Body>
            <Flex align="flex-start" gap={3}>
              <CardIcon>
                <TbBuilding />
              </CardIcon>
              <Text fontSize="sm" color="fg.muted">
                {organizationKeyNames.length === 1
                  ? 'The organization API key '
                  : `${organizationKeyNames.length} organization API keys `}
                <Text as="span" fontWeight="medium" color="fg">
                  {organizationKeyNames.join(', ')}
                </Text>{' '}
                {organizationKeyNames.length === 1 ? 'also has' : 'also have'} access to this project.{' '}
                <Link as="button" color="purple.fg" fontWeight="medium" onClick={() => openOrgSettings('api')}>
                  Manage them in the organization settings
                </Link>
                .
              </Text>
            </Flex>
          </Card.Body>
        </Card.Root>
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

          revokeKey({
            projectId,
            keyId: keyToRevoke.id,
          });
        }}
      />
    </Flex>
  );
};
