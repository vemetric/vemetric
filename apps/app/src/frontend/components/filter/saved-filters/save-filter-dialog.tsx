import { Button, Field, Flex, Input } from '@chakra-ui/react';
import type { IFilterConfig } from '@vemetric/common/filters';
import { useEffect, useState } from 'react';
import { TbFilter } from 'react-icons/tb';
import { EmojiIconButton } from '@/components/emoji-icon-button';
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';
import { toaster } from '@/components/ui/toaster';
import { trpc, type SavedFilterData } from '@/utils/trpc';

interface Props {
  projectId: string;
  /** Create mode: the current filter config that should be saved. */
  filterConfig?: IFilterConfig;
  /** Edit mode: the existing saved filter to rename / re-icon. */
  savedFilter?: SavedFilterData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SaveFilterDialog = ({ projectId, filterConfig, savedFilter, open, onOpenChange }: Props) => {
  const isEditMode = !!savedFilter;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const utils = trpc.useUtils();

  // Initialize the form whenever the dialog opens (prefilled in edit mode, empty in create mode).
  useEffect(() => {
    if (open) {
      setName(savedFilter?.name ?? '');
      setIcon(savedFilter?.icon ?? null);
    }
  }, [open, savedFilter]);

  const { mutate: createFilter, isLoading: isCreating } = trpc.savedFilters.create.useMutation({
    onSuccess: () => {
      utils.savedFilters.list.invalidate();
      toaster.create({ title: 'Filter saved', description: `"${name.trim()}" has been saved.`, type: 'success' });
      onOpenChange(false);
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message || 'Failed to save filter', type: 'error' });
    },
  });

  const { mutate: updateFilter, isLoading: isUpdating } = trpc.savedFilters.update.useMutation({
    onSuccess: () => {
      utils.savedFilters.list.invalidate();
      toaster.create({ title: 'Filter updated', type: 'success' });
      onOpenChange(false);
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message || 'Failed to update filter', type: 'error' });
    },
  });

  const isSubmitting = isCreating || isUpdating;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (trimmedName.length < 1) {
      toaster.create({ title: 'Error', description: 'Please enter a name', type: 'error' });
      return;
    }

    if (isEditMode) {
      updateFilter({ projectId, id: savedFilter.id, name: trimmedName, icon });
      return;
    }

    if (!filterConfig || filterConfig.filters.length === 0) {
      toaster.create({ title: 'Error', description: 'There are no active filters to save', type: 'error' });
      return;
    }

    createFilter({ projectId, name: trimmedName, icon, filterConfig });
  };

  return (
    <DialogRoot placement="center" size="md" open={open} onOpenChange={({ open }) => onOpenChange(open)}>
      <DialogContent as="form" onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle fontWeight="medium">{isEditMode ? 'Rename saved filter' : 'Save current filters'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field.Root>
            <Field.Label>Name & Icon</Field.Label>
            <Flex w="full" gap="2">
              <EmojiIconButton icon={icon} onIconChange={setIcon} defaultIcon={<TbFilter />} />
              <Input
                size="sm"
                placeholder="Enter a name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </Flex>
          </Field.Root>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline" colorPalette="gray" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogActionTrigger>
          <Button type="submit" colorPalette="purple" loading={isSubmitting}>
            {isEditMode ? 'Save' : 'Save filter'}
          </Button>
        </DialogFooter>
        <DialogCloseTrigger colorPalette="gray" />
      </DialogContent>
    </DialogRoot>
  );
};
