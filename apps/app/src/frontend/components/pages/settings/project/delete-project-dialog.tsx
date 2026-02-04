import { Button, Text, Input, Field, VStack, Span, Flex } from '@chakra-ui/react';
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
  projectDomain: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DeleteProjectDialog = (props: Props) => {
  const { organizationId, projectId, projectName, projectDomain, isOpen, onClose } = props;
  const [confirmDomain, setConfirmDomain] = useState('');

  const { mutate: requestDeletion, isPending } = trpc.projects.requestDeletion.useMutation({
    onSuccess: () => {
      handleClose();
      toaster.create({
        title: 'Check your email',
        description: `We've sent a confirmation link to delete "${projectName}". The link expires in 1 hour.`,
        type: 'info',
        duration: 10000,
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
    setConfirmDomain('');
    onClose();
  };

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    requestDeletion({ organizationId, projectId, confirmDomain });
  };

  const isConfirmDisabled = confirmDomain !== projectDomain;

  return (
    <DialogRoot open={isOpen} onOpenChange={handleClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Delete Project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack align="stretch" gap={4} as="form" id="delete-project-form" onSubmit={handleDelete}>
            <Flex flexDir="column" gap={2}>
              <Text>
                Are you sure you want to delete <strong>{projectName}</strong>{' '}
                <Span fontSize="sm" fontStyle="italic">
                  ({projectDomain})
                </Span>
                ?
              </Text>
              <Text>
                This action cannot be undone and will <strong>permanently delete</strong> all the data associated with
                this project.
              </Text>
            </Flex>
            <Field.Root>
              <Field.Label fontWeight="normal">
                Type <strong>{projectDomain}</strong> to confirm
              </Field.Label>
              <Input
                placeholder="Enter project domain"
                value={confirmDomain}
                onChange={(e) => setConfirmDomain(e.target.value)}
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
            Delete Project
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
