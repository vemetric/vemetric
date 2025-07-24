import { Button, Field, Input, Stack } from '@chakra-ui/react';
import { useState } from 'react';
import { TbChartFunnel } from 'react-icons/tb';
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
  DialogBackdrop,
} from '@/components/ui/dialog';
import { useAddFunnel } from '@/hooks/use-add-funnel';
import { FunnelStepBuilder } from './funnel-step-builder';
import { InputGroup } from '../../ui/input-group';

interface AddFunnelDialogProps {
  children?: React.ReactNode;
}

export const AddFunnelDialog = ({ children }: AddFunnelDialogProps) => {
  const [open, setOpen] = useState(false);
  const { isLoading, funnelName, setFunnelName, steps, setSteps, onSubmit, resetForm } = useAddFunnel({
    onSuccess: () => {
      setOpen(false);
      resetForm();
    },
  });

  return (
    <DialogRoot
      placement="top"
      size="lg"
      open={open}
      onOpenChange={({ open }) => {
        setOpen(open);
        if (!open) {
          resetForm();
        }
      }}
    >
      <DialogBackdrop />
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent as="form" onSubmit={onSubmit}>
        <DialogHeader>
          <Stack gap="1">
            <DialogTitle fontWeight="medium">Create a new Funnel</DialogTitle>
            <DialogDescription>
              Set up a funnel to track user progression through several steps in your product.
            </DialogDescription>
          </Stack>
        </DialogHeader>
        <DialogBody px="6">
          <Stack gap={{ base: '6', md: '8' }}>
            <Field.Root>
              <Field.Label>Funnel Name</Field.Label>
              <InputGroup startElement={<TbChartFunnel />} width="full">
                <Input
                  placeholder="Checkout Funnel"
                  value={funnelName}
                  onChange={(e) => setFunnelName(e.target.value)}
                  disabled={isLoading}
                />
              </InputGroup>
            </Field.Root>

            <FunnelStepBuilder steps={steps} onChange={setSteps} disabled={isLoading} />
          </Stack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline" colorPalette="gray" disabled={isLoading}>
              Cancel
            </Button>
          </DialogActionTrigger>
          <Button type="submit" colorPalette="purple" loading={isLoading}>
            Create Funnel
          </Button>
        </DialogFooter>
        <DialogCloseTrigger colorPalette="gray" />
      </DialogContent>
    </DialogRoot>
  );
};
