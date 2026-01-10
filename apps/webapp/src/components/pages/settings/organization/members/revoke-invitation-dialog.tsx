import { Button, Text } from '@chakra-ui/react';
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

interface Props {
  organizationId: string;
  token: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RevokeInvitationDialog = (props: Props) => {
  const { organizationId, token, onClose, onSuccess } = props;

  const { mutate: revokeInvitation, isPending } = trpc.organization.revokeInvitation.useMutation({
    onSuccess: () => {
      toaster.create({
        title: 'Invitation revoked',
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
    <DialogRoot open={!!token} onOpenChange={onClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Revoke Invitation</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text>
            Are you sure you want to revoke this invitation? The link will no longer work and anyone who has it will not
            be able to join.
          </Text>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorPalette="red"
            loading={isPending}
            onClick={() => {
              if (token) {
                revokeInvitation({ organizationId, token });
              }
            }}
          >
            Revoke
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
