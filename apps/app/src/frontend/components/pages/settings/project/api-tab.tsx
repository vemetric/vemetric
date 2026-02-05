import {
  AbsoluteCenter,
  Box,
  Button,
  Card,
  Clipboard,
  Field,
  Flex,
  Icon,
  IconButton,
  Input,
  Spinner,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { TbCheck, TbCopy, TbKey, TbLockX, TbPlus, TbTrash } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
}

export const ProjectApiTab = (props: Props) => {
  const { projectId } = props;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  const {
    data: apiKeys,
    error,
    isLoading,
    refetch,
  } = trpc.apiKeys.list.useQuery({ projectId });

  const { mutate: createKey, isPending: isCreating } = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setRawKey(data.rawKey);
      setKeyName('');
      refetch();
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message, type: 'error' });
    },
  });

  const { mutate: revokeKey, isPending: isRevoking } = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      setRevokeKeyId(null);
      refetch();
      toaster.create({ title: 'API key revoked', type: 'success' });
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message, type: 'error' });
    },
  });

  if (error) {
    if (error?.data?.httpStatus === 403) {
      return (
        <EmptyState
          icon={<TbLockX />}
          title="You don't have admin access to this project."
          description="API keys can only be managed by admins."
        />
      );
    }
    return <ErrorState title="Error loading API keys" />;
  }

  if (isLoading) {
    return (
      <Box h="200px" pos="relative">
        <AbsoluteCenter>
          <Spinner />
        </AbsoluteCenter>
      </Box>
    );
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    createKey({ projectId, name: keyName.trim() });
  };

  return (
    <Flex flexDir="column" gap={6}>
      <Card.Root>
        <Card.Header>
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={2}>
              <CardIcon>
                <TbKey />
              </CardIcon>
              <Text fontWeight="semibold">API Keys</Text>
            </Flex>
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <TbPlus /> Create Key
            </Button>
          </Flex>
        </Card.Header>
        <Card.Body p={4}>
          {apiKeys && apiKeys.length > 0 ? (
            <VStack align="stretch" gap={3}>
              {apiKeys.map((key) => (
                <Flex
                  key={key.id}
                  align="center"
                  justify="space-between"
                  p={3}
                  borderWidth={1}
                  rounded="md"
                  bg="bg.subtle"
                >
                  <Flex flexDir="column" gap={0.5}>
                    <Text fontWeight="medium" fontSize="sm">
                      {key.name}
                    </Text>
                    <Text fontFamily="mono" fontSize="xs" color="fg.muted">
                      {key.keyPrefix}
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                    </Text>
                  </Flex>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => setRevokeKeyId(key.id)}
                  >
                    <TbTrash /> Revoke
                  </Button>
                </Flex>
              ))}
            </VStack>
          ) : (
            <Text fontSize="sm" color="fg.muted" textAlign="center" py={4}>
              No API keys yet. Create one to get started.
            </Text>
          )}
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <Text fontWeight="semibold" fontSize="sm">
              Usage
            </Text>
          </Flex>
        </Card.Header>
        <Card.Body p={4}>
          <Stack gap={2}>
            <Text fontSize="sm" color="fg.muted">
              Include your API key in the <strong>Authorization</strong> header:
            </Text>
            <Box
              fontFamily="mono"
              fontSize="sm"
              p={3}
              borderWidth={1}
              rounded="md"
              bg="bg.subtle"
              whiteSpace="pre"
              overflowX="auto"
            >
              Authorization: Bearer vem_...
            </Box>
            <Text fontSize="sm" color="fg.muted">
              API docs are available at <strong>/api/docs</strong>
            </Text>
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Create Key Dialog */}
      <DialogRoot open={isCreateOpen} onOpenChange={() => setIsCreateOpen(false)}>
        <DialogContent mt={20}>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Stack as="form" id="create-api-key-form" onSubmit={handleCreate} gap={4}>
              <Field.Root>
                <Field.Label>Key Name</Field.Label>
                <Input
                  placeholder="e.g. Production, CI/CD, Dashboard"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  autoFocus
                />
              </Field.Root>
            </Stack>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              form="create-api-key-form"
              type="submit"
              loading={isCreating}
              disabled={!keyName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>

      {/* Show Raw Key Dialog */}
      <DialogRoot
        open={rawKey !== null}
        onOpenChange={() => setRawKey(null)}
      >
        <DialogContent mt={20}>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack align="stretch" gap={4}>
              <Text fontSize="sm" color="fg.warning" fontWeight="medium">
                Copy this key now. You won&apos;t be able to see it again.
              </Text>
              {rawKey && (
                <Clipboard.Root value={rawKey}>
                  <Flex
                    p={3}
                    borderWidth={1}
                    rounded="md"
                    bg="bg.subtle"
                    align="center"
                    gap={2}
                  >
                    <Box
                      as="code"
                      fontFamily="mono"
                      fontSize="sm"
                      color="orange.600"
                      _dark={{ color: 'orange.400' }}
                      flex={1}
                      wordBreak="break-all"
                    >
                      {rawKey}
                    </Box>
                    <Clipboard.Trigger asChild>
                      <IconButton size="sm" variant="ghost">
                        <Clipboard.Indicator
                          copied={
                            <Icon asChild color="green.500">
                              <TbCheck />
                            </Icon>
                          }
                        >
                          <Icon asChild color="fg.muted">
                            <TbCopy />
                          </Icon>
                        </Clipboard.Indicator>
                      </IconButton>
                    </Clipboard.Trigger>
                  </Flex>
                </Clipboard.Root>
              )}
            </VStack>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setRawKey(null)}>Done</Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>

      {/* Revoke Confirmation Dialog */}
      <DialogRoot open={revokeKeyId !== null} onOpenChange={() => setRevokeKeyId(null)}>
        <DialogContent mt={20}>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text>
              Are you sure you want to revoke this API key? Any applications using it will immediately lose access.
            </Text>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeKeyId(null)}>
              Cancel
            </Button>
            <Button
              colorPalette="red"
              loading={isRevoking}
              onClick={() => {
                if (revokeKeyId) revokeKey({ projectId, keyId: revokeKeyId });
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
