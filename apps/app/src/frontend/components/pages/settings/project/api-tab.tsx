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
  Table,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { TbAlertTriangle, TbKey, TbPlus, TbTrash } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { CodeBox } from '@/components/code-box';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';
import { toaster } from '@/components/ui/toaster';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
}

type NewKey = {
  rawKey: string;
  keyPrefix: string;
};

type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
};

export const ProjectApiTab = ({ projectId }: Props) => {
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);

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
              <TbKey />
            </CardIcon>
            <Text fontWeight="semibold">Public API Keys</Text>
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
            <Text fontWeight="semibold">Active Keys</Text>
            <Box flexGrow={1} />
            {!isLoadingKeys && <Badge colorPalette="purple">{keys.length}</Badge>}
          </Flex>
        </Card.Header>
        <Card.Body overflow="auto">
          {isLoadingKeys ? (
            <Box h="100px" pos="relative">
              <AbsoluteCenter>
                <Spinner />
              </AbsoluteCenter>
            </Box>
          ) : keys.length === 0 ? (
            <Box p={6} textAlign="center">
              <Text color="fg.muted" fontSize="sm">
                No API keys created yet.
              </Text>
            </Box>
          ) : (
            <Table.Root size="sm" variant="outline" rounded="md">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Name</Table.ColumnHeader>
                  <Table.ColumnHeader>Prefix</Table.ColumnHeader>
                  <Table.ColumnHeader>Created</Table.ColumnHeader>
                  <Table.ColumnHeader w="80px">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {keys.map((key) => (
                  <Table.Row key={key.id} css={{ '&:last-of-type > td': { borderBottom: 'none' } }}>
                    <Table.Cell>{key.name}</Table.Cell>
                    <Table.Cell>
                      <CodeBox size="sm">{key.keyPrefix}</CodeBox>
                    </Table.Cell>
                    <Table.Cell>{dateTimeFormatter.formatDate(key.createdAt)}</Table.Cell>
                    <Table.Cell>
                      <IconButton
                        aria-label="Revoke API key"
                        variant="ghost"
                        size="xs"
                        colorPalette="red"
                        onClick={() => setKeyToRevoke(key)}
                      >
                        <TbTrash />
                      </IconButton>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
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
                This is the only time the full key is shown. Copy it now and store it securely.
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
