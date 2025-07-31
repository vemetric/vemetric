import { Button } from '@chakra-ui/react';
import {
  DialogActionTrigger,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  isOpen,
  title = 'Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  return (
    <DialogRoot
      placement="top"
      open={isOpen}
      onOpenChange={({ open }) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent transform="translateY(40px)">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>{message}</DialogDescription>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline" colorPalette="gray" onClick={onCancel}>
              {cancelText}
            </Button>
          </DialogActionTrigger>
          <Button colorPalette="red" onClick={onConfirm}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
