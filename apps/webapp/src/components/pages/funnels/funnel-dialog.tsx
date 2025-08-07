import { Button, Field, Input, Stack, Spinner, Box } from '@chakra-ui/react';
import { useState } from 'react';
import { TbChartFunnel } from 'react-icons/tb';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFunnel } from '@/hooks/funnels/use-funnel';
import { FunnelStepBuilder } from './funnel-step-builder';
import { InputGroup } from '../../ui/input-group';

interface FunnelDialogProps {
  funnelId?: string;
  children?: React.ReactNode;
}

export const FunnelDialog = ({ funnelId, children }: FunnelDialogProps) => {
  const [open, _setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    hasChanges,
    isSubmitting,
    funnelName,
    setFunnelName,
    steps,
    setSteps,
    onSubmit,
    isEditMode,
    isLoadingFunnel,
  } = useFunnel({
    isDialogOpen: open,
    funnelId,
    onSuccess: () => {
      _setOpen(false);
    },
  });

  const setOpen = (open: boolean) => {
    if (hasChanges.current && !open) {
      setConfirmOpen(true);
      return;
    }

    _setOpen(open);
  };

  const handleConfirmDiscard = () => {
    setConfirmOpen(false);
    _setOpen(false);
  };

  return (
    <DialogRoot
      placement="top"
      size="lg"
      open={open}
      onOpenChange={({ open }) => {
        setOpen(open);
      }}
      onEscapeKeyDown={(e) => {
        if (document.activeElement?.className.includes('funnel-step-name')) {
          e.preventDefault();
        }
      }}
    >
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent as="form" onSubmit={onSubmit}>
        <DialogHeader>
          <Stack gap="1">
            <DialogTitle fontWeight="medium">{isEditMode ? 'Edit Funnel' : 'Create a new Funnel'}</DialogTitle>
            <DialogDescription>
              Set up a funnel to track user progression through several steps in your product.
            </DialogDescription>
          </Stack>
        </DialogHeader>
        <DialogBody px="6">
          <Stack pos="relative" gap={{ base: '6', md: '8' }}>
            <Field.Root>
              <Field.Label>Funnel Name</Field.Label>
              <InputGroup startElement={<TbChartFunnel />} width="full">
                <Input
                  placeholder="Enter funnel name..."
                  value={funnelName}
                  onChange={(e) => setFunnelName(e.target.value)}
                  disabled={isSubmitting || isLoadingFunnel}
                />
              </InputGroup>
            </Field.Root>

            <FunnelStepBuilder steps={steps} onChange={setSteps} disabled={isSubmitting || isLoadingFunnel} />
          </Stack>

          {isLoadingFunnel && (
            <Box
              pos="absolute"
              inset="0"
              bg="bg.panel/80"
              backdropFilter="blur(2px)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              zIndex="overlay"
            >
              <Spinner size="lg" colorPalette="purple" />
            </Box>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline" colorPalette="gray" disabled={isSubmitting || isLoadingFunnel}>
              Cancel
            </Button>
          </DialogActionTrigger>
          <Button type="submit" colorPalette="purple" loading={isSubmitting || isLoadingFunnel}>
            {isEditMode ? 'Update Funnel' : 'Create Funnel'}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger colorPalette="gray" />
      </DialogContent>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Discard Changes"
        message="Your changes will be lost. Are you sure you want to continue?"
        confirmText="Discard"
        cancelText="Keep Editing"
        onConfirm={handleConfirmDiscard}
        onCancel={() => setConfirmOpen(false)}
      />
    </DialogRoot>
  );
};
