import { AbsoluteCenter, Box, Button, Card, Flex, Image, Spinner, Stack, Text } from '@chakra-ui/react';
import { format, formatDistanceToNow } from 'date-fns';
import { useRef, useState } from 'react';
import { TbAlertTriangle, TbPlugConnected } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import {
  describeOauthAccess,
  OauthAccessChoice,
  useOauthAccessChoice,
  type ShareableOrganization,
} from '@/components/oauth-access-choice';
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
import { trpc, type OauthConnectionItem } from '@/utils/trpc';

/** The apps (e.g. AI assistants like Claude) the user connected to Vemetric via OAuth. */
export const AccountConnectedAppsTab = () => {
  const { data, error, isLoading } = trpc.oauth.listConnections.useQuery();
  const [connectionToEdit, setConnectionToEdit] = useState<OauthConnectionItem | null>(null);
  const [connectionToDisconnect, setConnectionToDisconnect] = useState<OauthConnectionItem | null>(null);

  if (error) {
    return <ErrorState title="Error loading connected apps" />;
  }

  if (isLoading || !data) {
    return (
      <Box h="200px" pos="relative">
        <AbsoluteCenter>
          <Spinner />
        </AbsoluteCenter>
      </Box>
    );
  }

  return (
    <Flex flexDir="column" gap={4} p={4}>
      <Text fontSize="sm" color="fg.muted">
        Apps you connected to Vemetric, like AI assistants that answer questions about your analytics. They have
        read-only access to the organizations and projects you shared with them.
      </Text>

      {data.connections.length === 0 ? (
        <Card.Root>
          <Card.Body>
            <EmptyState
              icon={<TbPlugConnected />}
              title="No connected apps"
              description="When you connect an app like Claude or ChatGPT to Vemetric, it shows up here."
            />
          </Card.Body>
        </Card.Root>
      ) : (
        data.connections.map((connection) => (
          <ConnectedAppCard
            key={connection.client.clientId}
            connection={connection}
            organizations={data.organizations}
            onEdit={() => setConnectionToEdit(connection)}
            onDisconnect={() => setConnectionToDisconnect(connection)}
          />
        ))
      )}

      {connectionToEdit && (
        <EditAccessDialog
          connection={connectionToEdit}
          organizations={data.organizations}
          onClose={() => setConnectionToEdit(null)}
        />
      )}
      <DisconnectDialog connection={connectionToDisconnect} onClose={() => setConnectionToDisconnect(null)} />
    </Flex>
  );
};

interface ConnectedAppCardProps {
  connection: OauthConnectionItem;
  organizations: ShareableOrganization[];
  onEdit: () => void;
  onDisconnect: () => void;
}

const ConnectedAppCard = ({ connection, organizations, onEdit, onDisconnect }: ConnectedAppCardProps) => {
  const { client } = connection;
  return (
    <Card.Root>
      <Card.Body p={4}>
        <Flex gap={3} align="flex-start">
          {client.icon ? (
            <Image src={client.icon} alt="" boxSize="36px" rounded="md" flexShrink={0} />
          ) : (
            <CardIcon>
              <TbPlugConnected />
            </CardIcon>
          )}
          <Stack gap={1} flex="1" minW={0}>
            <Text fontWeight="medium">{client.name}</Text>
            {client.metadataHost && (
              <Text fontSize="xs" color="fg.muted">
                Registered by {client.metadataHost}
              </Text>
            )}
            <Text fontSize="sm" color="fg.muted">
              Access: {describeOauthAccess(connection.access, organizations)}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Connected on {format(new Date(connection.connectedAt), 'PP')}
              {connection.lastUsedAt &&
                ` · last active ${formatDistanceToNow(new Date(connection.lastUsedAt), { addSuffix: true })}`}
            </Text>
          </Stack>
        </Flex>
        <Flex gap={2} mt={3} justify="flex-end">
          <Button size="xs" variant="surface" onClick={onEdit}>
            Change access
          </Button>
          <Button size="xs" variant="surface" colorPalette="red" onClick={onDisconnect}>
            Disconnect
          </Button>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
};

interface EditAccessDialogProps {
  connection: OauthConnectionItem;
  organizations: ShareableOrganization[];
  onClose: () => void;
}

const EditAccessDialog = ({ connection, organizations, onClose }: EditAccessDialogProps) => {
  const utils = trpc.useUtils();
  const accessChoice = useOauthAccessChoice(organizations, connection.access);
  // Focus "Save" instead of the first switch, so the dialog doesn't open with a focus ring on the access choice.
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const { mutate: updateAccess, isPending } = trpc.oauth.updateAccess.useMutation({
    onSuccess: () => {
      utils.oauth.listConnections.invalidate();
      toaster.create({ title: `Access of ${connection.client.name} updated`, type: 'success' });
      onClose();
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message, type: 'error' });
    },
  });

  return (
    <DialogRoot open onOpenChange={onClose} initialFocusEl={() => saveButtonRef.current}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Change access of {connection.client.name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <OauthAccessChoice state={accessChoice} disabled={isPending} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            ref={saveButtonRef}
            colorPalette="purple"
            loading={isPending}
            disabled={accessChoice.sharesNothing}
            onClick={() => updateAccess({ clientId: connection.client.clientId, access: accessChoice.access })}
          >
            Save
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};

const DisconnectDialog = ({ connection, onClose }: { connection: OauthConnectionItem | null; onClose: () => void }) => {
  const utils = trpc.useUtils();
  const { mutate: disconnect, isPending } = trpc.oauth.disconnect.useMutation({
    onSuccess: () => {
      utils.oauth.listConnections.invalidate();
      toaster.create({ title: `${connection?.client.name ?? 'The app'} was disconnected`, type: 'success' });
      onClose();
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message, type: 'error' });
    },
  });

  return (
    <DialogRoot open={connection !== null} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect App</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Flex gap={2} align="flex-start">
            <CardIcon bg="red.subtle" color="red.600" borderColor="red.muted">
              <TbAlertTriangle />
            </CardIcon>
            <Text fontSize="sm">
              Disconnect <strong>{connection?.client.name}</strong>? It loses access to your analytics right away. To
              use it again, you&apos;ll have to connect it again.
            </Text>
          </Flex>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorPalette="red"
            loading={isPending}
            onClick={() => connection && disconnect({ clientId: connection.client.clientId })}
          >
            Disconnect
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
