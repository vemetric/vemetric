import {
  AbsoluteCenter,
  Badge,
  Box,
  Button,
  Card,
  Field,
  Flex,
  IconButton,
  Input,
  Spinner,
  Switch,
  Table,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { TbAlertTriangle, TbApi, TbKey, TbPlus, TbTrash } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { CodeBox } from '@/components/code-box';
import { DocsButton } from '@/components/docs-button';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { UserIdentity } from '@/components/user-identity';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import type { ApiKeyItem } from '@/utils/trpc';
import { trpc } from '@/utils/trpc';

type NewKey = {
  rawKey: string;
  keyPrefix: string;
};

interface Props {
  projectId: string;
}

export const ProjectApiTab = ({ projectId }: Props) => {
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);
  const [showRevokedKeys, setShowRevokedKeys] = useState(false);

  const {
    data,
    refetch,
    isLoading: isLoadingKeys,
  } = trpc.apiKeys.list.useQuery({
    projectId,
  });

  const { mutate: createKey, isPending: isCreating } = trpc.apiKeys.create.useMutation({
    onSuccess: async (result) => {
      setName('');
      setNewKey(result);
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

  const keys = data ?? [];
  const activeKeys = keys.filter((key) => !key.revokedAt);
  const revokedKeys = keys.filter((key) => Boolean(key.revokedAt));
  const visibleKeys = showRevokedKeys ? [...activeKeys, ...revokedKeys] : activeKeys;

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
            API keys are scoped to this project and can only be managed by organization admins.
          </Text>
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbKey />
            </CardIcon>
            <Text fontWeight="semibold">Keys</Text>
            <Box flexGrow={1} />
            {!isLoadingKeys && <Badge colorPalette="purple">{activeKeys.length}</Badge>}
          </Flex>
        </Card.Header>
        <Card.Body overflow="auto">
          {isLoadingKeys ? (
            <Box h="100px" pos="relative">
              <AbsoluteCenter>
                <Spinner />
              </AbsoluteCenter>
            </Box>
          ) : visibleKeys.length === 0 ? (
            <Box p={6} textAlign="center">
              <EmptyState icon={<TbKey />} title="No API keys available for this project." />
            </Box>
          ) : (
            <Table.Root size="sm" variant="outline" rounded="md">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Prefix</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader w="80px">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {visibleKeys.map((key) => (
                  <Table.Row
                    key={key.id}
                    css={{ '&:last-of-type > td': { borderBottom: 'none' } }}
                    opacity={key.revokedAt ? 0.65 : 1}
                  >
                    <Table.Cell>{key.name}</Table.Cell>
                    <Table.Cell>
                      <CodeBox size="sm">{key.keyPrefix}</CodeBox>
                    </Table.Cell>
                    <Table.Cell w="100px">
                      <Tooltip
                        content={
                          <Box py="1">
                            <Text fontSize="xs" mb={2}>
                              Created on {dateTimeFormatter.formatDate(key.createdAt)} by
                            </Text>
                            <UserIdentity
                              displayName={key.createdBy?.name || key.createdBy?.email || 'Unknown'}
                              image={key.createdBy?.image}
                              avatarSize="2xs"
                            />
                            {key.revokedAt && (
                              <>
                                <Text fontSize="xs" mt={5} mb={2}>
                                  Revoked on {dateTimeFormatter.formatDate(key.revokedAt)} by
                                </Text>
                                <UserIdentity
                                  displayName={key.revokedBy?.name || key.revokedBy?.email || 'Unknown'}
                                  image={key.revokedBy?.image}
                                  avatarSize="2xs"
                                />
                              </>
                            )}
                          </Box>
                        }
                      >
                        <Badge colorPalette={key.revokedAt ? 'red' : 'green'} cursor="help">
                          {key.revokedAt ? 'Revoked' : 'Active'}
                        </Badge>
                      </Tooltip>
                    </Table.Cell>
                    <Table.Cell>
                      {!key.revokedAt && (
                        <IconButton
                          aria-label="Revoke API key"
                          variant="ghost"
                          size="xs"
                          colorPalette="red"
                          onClick={() => setKeyToRevoke(key)}
                        >
                          <TbTrash />
                        </IconButton>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}

          <Flex mt={4} align="center" justify="flex-end" gap={2}>
            <Switch.Root
              size="sm"
              checked={showRevokedKeys}
              onCheckedChange={({ checked }) => setShowRevokedKeys(checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="xs" color="fg.subtle">
                Show revoked keys
              </Switch.Label>
            </Switch.Root>
          </Flex>
        </Card.Body>
      </Card.Root>

      <DialogRoot open={Boolean(newKey)} onOpenChange={() => setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy API Key</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Flex direction="column" gap={3}>
              <Text fontSize="sm" color="fg.muted">
                This is the only time the full key is shown.
                <br />
                Copy it now and store it securely.
              </Text>
              {newKey && <CodeBox>{newKey.rawKey}</CodeBox>}
            </Flex>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>

      <DialogRoot open={Boolean(keyToRevoke)} onOpenChange={() => setKeyToRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Flex gap={2} align="flex-start">
              <CardIcon bg="red.subtle" color="red.600" borderColor="red.muted">
                <TbAlertTriangle />
              </CardIcon>
              <Text fontSize="sm">
                Revoke key <strong>{keyToRevoke?.name}</strong>? Existing integrations using this key will stop working
                immediately.
              </Text>
            </Flex>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyToRevoke(null)}>
              Cancel
            </Button>
            <Button
              colorPalette="red"
              loading={isRevoking}
              onClick={() => {
                if (!keyToRevoke) {
                  return;
                }

                revokeKey({
                  projectId,
                  keyId: keyToRevoke.id,
                });
              }}
            >
              Revoke Key
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>
    </Flex>
  );
};
