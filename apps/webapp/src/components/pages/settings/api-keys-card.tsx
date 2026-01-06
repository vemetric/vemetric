import {
  Badge,
  Button,
  Card,
  Field,
  Flex,
  HStack,
  Icon,
  Input,
  Spinner,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { TbCheck, TbCopy, TbKey, TbPlus, TbTrash } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
}

export const ApiKeysCard = (props: Props) => {
  const { projectId } = props;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: apiKeys, isLoading } = trpc.projects.listApiKeys.useQuery({ projectId });

  const { mutate: createApiKey, isLoading: isCreating } = trpc.projects.createApiKey.useMutation({
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setNewKeyName('');
      utils.projects.listApiKeys.invalidate({ projectId });
      toaster.create({
        title: 'API key created successfully',
        description: 'Make sure to copy your key now. You won\'t be able to see it again!',
        type: 'success',
      });
    },
    onError: (error) => {
      toaster.create({
        title: 'Error creating API key',
        description: error.message,
        type: 'error',
      });
    },
  });

  const { mutate: revokeApiKey, isLoading: isRevoking } = trpc.projects.revokeApiKey.useMutation({
    onSuccess: () => {
      utils.projects.listApiKeys.invalidate({ projectId });
      toaster.create({
        title: 'API key revoked',
        type: 'success',
      });
    },
    onError: (error) => {
      toaster.create({
        title: 'Error revoking API key',
        description: error.message,
        type: 'error',
      });
    },
    onSettled: () => {
      setRevokingKeyId(null);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createApiKey({ projectId, name: newKeyName.trim() });
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toaster.create({
        title: 'Failed to copy',
        description: 'Please copy the key manually',
        type: 'error',
      });
    }
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreatedKey(null);
    setNewKeyName('');
    setCopied(false);
  };

  const handleRevokeKey = (keyId: string) => {
    setRevokingKeyId(keyId);
    revokeApiKey({ projectId, keyId });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <Card.Root>
        <Card.Header>
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={2}>
              <CardIcon>
                <TbKey />
              </CardIcon>
              <Text fontWeight="semibold">API Keys</Text>
            </Flex>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Icon as={TbPlus} mr={1} />
              Create Key
            </Button>
          </Flex>
        </Card.Header>
        <Card.Body p={4} pb={3}>
          <Stack gap="3">
            <Text fontSize="sm" color="fg.muted">
              API keys allow you to access your analytics data programmatically via the REST API.
            </Text>

            {isLoading ? (
              <Flex justify="center" py={4}>
                <Spinner size="sm" />
              </Flex>
            ) : apiKeys && apiKeys.length > 0 ? (
              <Table.Root size="sm" variant="outline" rounded="md">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader>Key</Table.ColumnHeader>
                    <Table.ColumnHeader>Created</Table.ColumnHeader>
                    <Table.ColumnHeader>Last Used</Table.ColumnHeader>
                    <Table.ColumnHeader w="80px"></Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {apiKeys.map((key) => (
                    <Table.Row key={key.id}>
                      <Table.Cell fontWeight="medium">{key.name}</Table.Cell>
                      <Table.Cell>
                        <Badge variant="subtle" fontFamily="mono" fontSize="xs">
                          {key.keyPrefix}...
                        </Badge>
                      </Table.Cell>
                      <Table.Cell fontSize="sm" color="fg.muted">
                        {formatDate(key.createdAt)}
                      </Table.Cell>
                      <Table.Cell fontSize="sm" color="fg.muted">
                        {formatDate(key.lastUsedAt)}
                      </Table.Cell>
                      <Table.Cell>
                        <Tooltip content="Revoke this API key" positioning={{ placement: 'top' }}>
                          <Button
                            size="xs"
                            variant="ghost"
                            colorPalette="red"
                            onClick={() => handleRevokeKey(key.id)}
                            disabled={isRevoking}
                          >
                            {revokingKeyId === key.id ? (
                              <Spinner size="xs" />
                            ) : (
                              <Icon as={TbTrash} />
                            )}
                          </Button>
                        </Tooltip>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            ) : (
              <Flex
                direction="column"
                align="center"
                justify="center"
                py={8}
                borderWidth={1}
                borderStyle="dashed"
                borderRadius="md"
                gap={2}
              >
                <Icon as={TbKey} boxSize={8} color="fg.muted" />
                <Text fontSize="sm" color="fg.muted">
                  No API keys yet
                </Text>
                <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  Create your first API key
                </Button>
              </Flex>
            )}
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Create API Key Dialog */}
      <DialogRoot open={createDialogOpen} onOpenChange={({ open }) => !open && handleCloseCreateDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {createdKey ? (
              <Stack gap={4}>
                <Text fontSize="sm" color="fg.muted">
                  Your API key has been created. Make sure to copy it now - you won't be able to see it again!
                </Text>
                <Field.Root>
                  <Field.Label>Your API Key</Field.Label>
                  <HStack>
                    <Input
                      value={createdKey}
                      readOnly
                      fontFamily="mono"
                      fontSize="sm"
                      pr="40px"
                    />
                    <Button
                      size="sm"
                      variant={copied ? 'solid' : 'outline'}
                      colorPalette={copied ? 'green' : 'gray'}
                      onClick={handleCopyKey}
                    >
                      <Icon as={copied ? TbCheck : TbCopy} />
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </HStack>
                </Field.Root>
              </Stack>
            ) : (
              <form id="create-api-key-form" onSubmit={handleCreateSubmit}>
                <Stack gap={4}>
                  <Text fontSize="sm" color="fg.muted">
                    Give your API key a descriptive name so you can identify it later.
                  </Text>
                  <Field.Root required>
                    <Field.Label>Name</Field.Label>
                    <Input
                      placeholder="e.g., Production Server, Analytics Dashboard"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      disabled={isCreating}
                    />
                  </Field.Root>
                </Stack>
              </form>
            )}
          </DialogBody>
          <DialogFooter>
            {createdKey ? (
              <Button onClick={handleCloseCreateDialog}>Done</Button>
            ) : (
              <>
                <DialogActionTrigger asChild>
                  <Button variant="outline" onClick={handleCloseCreateDialog}>
                    Cancel
                  </Button>
                </DialogActionTrigger>
                <Button
                  type="submit"
                  form="create-api-key-form"
                  colorPalette="purple"
                  loading={isCreating}
                  disabled={!newKeyName.trim()}
                >
                  Create Key
                </Button>
              </>
            )}
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>
    </>
  );
};
