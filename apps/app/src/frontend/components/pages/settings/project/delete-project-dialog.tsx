import { Button, Text, Input, Field, VStack } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
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
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteProjectDialog = (props: Props) => {
  const { organizationId, projectId, projectName, isOpen, onClose } = props;
  const [confirmName, setConfirmName] = useState('');
  const navigate = useNavigate();
  const trpcUtils = trpc.useUtils();

  const { mutate: deleteProject, isPending } = trpc.projects.delete.useMutation({
    onSuccess: async () => {
      toaster.create({
        title: 'Project deleted successfully',
        type: 'success',
      });
      await trpcUtils.invalidate();
      navigate({ to: '/' });
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  const handleClose = () => {
    setConfirmName('');
    onClose();
  };

  const handleDelete = () => {
    deleteProject({ organizationId, projectId, confirmName });
  };

  const isConfirmDisabled = confirmName !== projectName;

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack align="stretch" gap={4}>
            <Text>
              Are you sure you want to delete <strong>{projectName}</strong>? This action cannot be undone and will
              permanently delete all project data including funnels and email sequences.
            </Text>
            <Field.Root>
              <Field.Label>
                Type <strong>{projectName}</strong> to confirm
              </Field.Label>
              <Input
                placeholder="Enter project name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
              />
            </Field.Root>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button colorPalette="red" loading={isPending} disabled={isConfirmDisabled} onClick={handleDelete}>
            Delete Project
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
