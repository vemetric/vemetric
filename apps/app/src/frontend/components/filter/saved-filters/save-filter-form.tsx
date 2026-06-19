import { Button, Flex, Input } from '@chakra-ui/react';
import type { IFilterConfig } from '@vemetric/common/filters';
import { useEffect, useRef, useState } from 'react';
import { TbFilter } from 'react-icons/tb';
import { EmojiIconButton } from '@/components/emoji-icon-button';
import { PopoverMenuHeader } from '@/components/popover-menu/popover-menu-header';
import { toaster } from '@/components/ui/toaster';
import { trpc, type SavedFilterData } from '@/utils/trpc';

interface Props {
  projectId: string;
  filterConfig?: IFilterConfig;
  savedFilter?: SavedFilterData;
  onBack?: () => void;
  onSuccess: () => void;
}

export const SaveFilterForm = ({ projectId, filterConfig, savedFilter, onBack, onSuccess }: Props) => {
  const isEditMode = !!savedFilter;
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(savedFilter?.name ?? '');
  const [icon, setIcon] = useState<string | null>(savedFilter?.icon ?? null);
  const utils = trpc.useUtils();

  useEffect(() => {
    // we wait for the slide in animation to be finished so it doesn't get interrupted
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(timeout);
  }, []);

  const { mutate: createFilter, isLoading: isCreating } = trpc.savedFilters.create.useMutation({
    onSuccess: () => {
      utils.savedFilters.list.invalidate();
      toaster.create({ title: 'Filter saved', description: `"${name.trim()}" has been saved.`, type: 'success' });
      onSuccess();
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message || 'Failed to save filter', type: 'error' });
    },
  });

  const { mutate: updateFilter, isLoading: isUpdating } = trpc.savedFilters.update.useMutation({
    onSuccess: () => {
      utils.savedFilters.list.invalidate();
      toaster.create({ title: 'Filter updated', type: 'success' });
      onSuccess();
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
    <>
      <PopoverMenuHeader title={isEditMode ? 'Edit Filter' : 'Create Filter'} onBack={onBack} />
      <Flex direction="column" gap={3} p={3} as="form" onSubmit={onSubmit}>
        <Flex w="full" gap={2}>
          <EmojiIconButton icon={icon} onIconChange={setIcon} defaultIcon={<TbFilter />} />
          <Input
            ref={inputRef}
            size="sm"
            placeholder="Enter a name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
          />
        </Flex>
        <Button type="submit" w="full" size="sm" colorPalette="purple" loading={isSubmitting}>
          Save Filter
        </Button>
      </Flex>
    </>
  );
};
