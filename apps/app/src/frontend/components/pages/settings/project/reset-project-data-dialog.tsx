import { Button, Text, Input, Field, VStack, Flex } from '@chakra-ui/react';
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
const DELETE_TEXT = 'DELETE';
export const ResetProjectDataDialog = (props: Props) => {
  const { organizationId, projectId, projectName, isOpen, onClose } = props;
  const [deleteText, setDeleteText] = useState('');

  const { mutate: resetProjectData, isPending } = trpc.projects.resetProjectData.useMutation({
    onSuccess: () => {
      handleClose();
      toaster.create({
        title: 'Data reset',
        description: `All data for "${projectName}" has been successfully reset.`,
        type: 'success',
        duration: 5000,
        meta: { closable: true },
      });
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
    setDeleteText('');
    onClose();
  };

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    resetProjectData({ organizationId, projectId });
  };

  const isConfirmDisabled = deleteText !== DELETE_TEXT;

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Reset Data</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack align="stretch" gap={4} as="form" id="delete-project-form" onSubmit={handleDelete}>
            <Flex flexDir="column" gap={2}>
              <Text>
                Are you sure you want to delete all the data associated with the project <strong>{projectName}</strong>?
              </Text>
              <Text>
                 This will permanently <strong>delete all the data</strong> associated with this project. Useful to clear data
                collected during initial setup and testing. This action cannot be undone.
              </Text>
            </Flex>
            <Field.Root>
              <Field.Label fontWeight="normal">
                Type <strong>DELETE</strong> to confirm
              </Field.Label>
              <Input
                placeholder="Enter DELETE to confirm"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                autoComplete="off"
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
            disabled={isConfirmDisabled}
            form="delete-project-form"
            type="submit"
          >
            Reset Data
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
