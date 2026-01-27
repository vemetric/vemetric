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
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
}

export const DeleteProjectDialog = (props: Props) => {
  const { projectId, projectName, open, onClose } = props;
  const [confirmationName, setConfirmationName] = useState('');
  const navigate = useNavigate();
  const { organizationId } = useCurrentOrganization();

  const { mutate: deleteProject, isPending } = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toaster.create({
        title: 'Project deleted successfully',
        type: 'success',
      });
      onClose();
      navigate({ to: '/o/$organizationId', params: { organizationId } });
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
    setConfirmationName('');
    onClose();
  };

  const isConfirmationValid = confirmationName === projectName;

  return (
    <DialogRoot open={open} onOpenChange={handleClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack align="stretch" gap={4}>
            <Text>
              Are you sure you want to delete <strong>{projectName}</strong>? This action cannot be undone.
            </Text>
            <Text fontSize="sm" color="fg.muted">
              All analytics data, funnels, and settings associated with this project will be permanently deleted.
            </Text>
            <Field.Root>
              <Field.Label>
                Type <strong>{projectName}</strong> to confirm
              </Field.Label>
              <Input
                placeholder="Enter project name"
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                disabled={isPending}
              />
            </Field.Root>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorPalette="red"
            loading={isPending}
            disabled={!isConfirmationValid}
            onClick={() => {
              deleteProject({ projectId, confirmationName });
            }}
          >
            Delete Project
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
