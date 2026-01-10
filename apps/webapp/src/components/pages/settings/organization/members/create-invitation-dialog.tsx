import { Badge, Button, Text } from '@chakra-ui/react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';
import { getAppUrl } from '@/utils/url';

interface Props {
  organizationId: string;
  role: 'ADMIN' | 'MEMBER' | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateInvitationDialog = (props: Props) => {
  const { organizationId, role, onClose, onSuccess } = props;

  const { mutate: createInvitation, isPending } = trpc.organization.createInvitation.useMutation({
    onSuccess: async (data) => {
      const inviteUrl = `${getAppUrl()}/invite/${data.invitation.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      toaster.create({
        title: 'Invitation link copied to clipboard',
        type: 'success',
      });
      onSuccess();
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
    <DialogRoot open={!!role} onOpenChange={onClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Create Invitation Link</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text>
            Create an invitation link for a new{' '}
            <Badge colorPalette={role === 'ADMIN' ? 'purple' : 'gray'}>{role}</Badge>? The link will be copied to your
            clipboard and can be shared with anyone you want to invite.
          </Text>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorPalette="purple"
            loading={isPending}
            onClick={() => {
              if (role) {
                createInvitation({ organizationId, role });
              }
            }}
          >
            Create & Copy Link
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
