import { Button, Flex, Icon } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TbTrash } from 'react-icons/tb';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { toaster } from '@/components/ui/toaster';
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
  userId: string;
  userName: string;
  isIdentified: boolean;
}

export const DeleteUserButton = ({ projectId, userId, userName, isIdentified }: Props) => {
  const { isAdmin } = useCurrentOrganization();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);

  const { mutate: deleteUser, isLoading } = trpc.users.delete.useMutation({
    onSuccess: async () => {
      setIsOpen(false);
      toaster.create({
        title: 'User deleted',
        description: 'Their data disappears from your dashboards within a few minutes.',
        type: 'success',
        duration: 6000,
      });
      await utils.users.list.invalidate();
      navigate({ to: '/p/$projectId/users', params: { projectId } });
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message || 'Failed to delete the user', type: 'error' });
    },
  });

  if (!isAdmin) {
    return null;
  }

  const comesBack = isIdentified
    ? 'If they visit again, they are tracked as a new user.'
    : 'If they visit again with the same browser, they are tracked again.';

  return (
    <Flex justify="flex-end">
      <Button
        variant="ghost"
        size="xs"
        color="fg.subtle"
        _hover={{ color: 'red.fg', bg: 'red.subtle' }}
        loading={isLoading}
        onClick={() => setIsOpen(true)}
      >
        <Icon asChild>
          <TbTrash />
        </Icon>
        Delete user
      </Button>
      <ConfirmDialog
        isOpen={isOpen}
        title="Delete user"
        message={`All events, sessions and attributes of ${userName} will be deleted permanently. ${comesBack}`}
        confirmText="Delete user"
        onConfirm={() => deleteUser({ projectId, userId })}
        onCancel={() => setIsOpen(false)}
      />
    </Flex>
  );
};
