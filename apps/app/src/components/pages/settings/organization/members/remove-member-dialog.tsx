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
  member: { userId: string; name: string; email: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RemoveMemberDialog = (props: Props) => {
  const { organizationId, member, onClose, onSuccess } = props;

  const { mutate: removeMember, isPending } = trpc.organization.removeMember.useMutation({
    onSuccess: () => {
      toaster.create({
        title: 'Member removed successfully',
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
    <DialogRoot open={!!member} onOpenChange={onClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Remove Member</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text>
            Are you sure you want to remove <strong>{member?.name}</strong> ({member?.email}) from this organization?
            They will lose access to all projects.
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
              if (member) {
                removeMember({ organizationId, userId: member.userId });
              }
            }}
          >
            Remove
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
