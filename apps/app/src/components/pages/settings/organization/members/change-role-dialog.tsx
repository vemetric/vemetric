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
import { MemberBadge } from './member-badge';
import { MemberRoleAlert } from './member-role-alert';

interface Props {
  organizationId: string;
  member: { userId: string; name: string; currentRole: 'ADMIN' | 'MEMBER'; newRole: 'ADMIN' | 'MEMBER' } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangeRoleDialog = (props: Props) => {
  const { organizationId, member, onClose, onSuccess } = props;

  const { mutate: updateRole, isPending } = trpc.organization.updateMemberRole.useMutation({
    onSuccess: () => {
      toaster.create({
        title: 'Role updated successfully',
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

  const isPromotingToAdmin = member?.newRole === 'ADMIN';

  if (!member) {
    return null;
  }

  return (
    <DialogRoot open onOpenChange={onClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>{isPromotingToAdmin ? 'Promote to Admin' : 'Change to Member'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text mb={3}>
            Are you sure you want to change <strong>{member.name}</strong> from{' '}
            <MemberBadge role={member.currentRole} /> to <MemberBadge role={member.newRole} />?
          </Text>
          <MemberRoleAlert role={member.newRole} />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorPalette="purple"
            loading={isPending}
            onClick={() => {
              updateRole({ organizationId, userId: member.userId, role: member.newRole });
            }}
          >
            {isPromotingToAdmin ? 'Promote to Admin' : 'Change to Member'}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
