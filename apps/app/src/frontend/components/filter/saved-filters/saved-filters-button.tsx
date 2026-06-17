import { Button, Flex, Icon, IconButton, Popover, Portal, Spinner, Text } from '@chakra-ui/react';
import type { IFilterConfig } from '@vemetric/common/filters';
import { useState } from 'react';
import { TbBookmark, TbDeviceFloppy, TbEdit, TbTrash } from 'react-icons/tb';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CustomIconStyle } from '@/components/custom-icon-style';
import { PopoverMenuButton } from '@/components/popover-menu/popover-menu-button';
import { PopoverMenuHeader } from '@/components/popover-menu/popover-menu-header';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { useProjectContext } from '@/contexts/project-context';
import type { RoutesWithFiltering } from '@/hooks/use-filters';
import { useFilters } from '@/hooks/use-filters';
import { trpc, type SavedFilterData } from '@/utils/trpc';
import { SaveFilterDialog } from './save-filter-dialog';

interface Props {
  filterConfig: IFilterConfig;
  from: RoutesWithFiltering;
}

export const SavedFiltersButton = ({ filterConfig, from }: Props) => {
  const { projectId } = useProjectContext();
  const { setFilters } = useFilters({ from });
  const utils = trpc.useUtils();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialog, setDialog] = useState<{ savedFilter?: SavedFilterData } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedFilterData | null>(null);

  const { data, isLoading } = trpc.savedFilters.list.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const savedFilters = data?.savedFilters ?? [];
  const hasActiveFilters = (filterConfig?.filters.length ?? 0) > 0;

  const { mutate: updateFilter } = trpc.savedFilters.update.useMutation({
    onSuccess: () => {
      utils.savedFilters.list.invalidate();
      toaster.create({
        title: 'Filter updated',
        description: 'The saved filter now uses your current filters.',
        type: 'success',
      });
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message || 'Failed to update filter', type: 'error' });
    },
  });

  const { mutate: deleteFilter } = trpc.savedFilters.delete.useMutation({
    onSuccess: () => {
      utils.savedFilters.list.invalidate();
      setDeleteTarget(null);
      toaster.create({ title: 'Filter deleted', type: 'success' });
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message || 'Failed to delete filter', type: 'error' });
    },
  });

  if (!projectId) {
    return null;
  }

  const loadFilter = (savedFilter: SavedFilterData) => {
    setFilters(savedFilter.filterConfig);
    setPopoverOpen(false);
  };

  return (
    <>
      <Popover.Root
        open={popoverOpen}
        onOpenChange={({ open }) => setPopoverOpen(open)}
        positioning={{ placement: 'bottom-end', gutter: 5 }}
      >
        <Popover.Trigger asChild>
          <Button variant="surface" px={2.5} size={{ base: 'xs', md: 'sm' }}>
            <Icon as={TbBookmark} />
            Saved
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content w="290px">
              <PopoverMenuHeader title="Saved filters">
                <Button
                  variant="surface"
                  size="2xs"
                  rounded="sm"
                  disabled={!hasActiveFilters}
                  onClick={() => {
                    setPopoverOpen(false);
                    setDialog({});
                  }}
                >
                  Save current
                </Button>
              </PopoverMenuHeader>
              <Flex
                flexDir="column"
                bg="purple.muted"
                roundedBottom="md"
                overflow="hidden"
                maxH="280px"
                overflowY="auto"
                css={{ '& > *:not(:last-child)': { borderBottom: '1px solid var(--chakra-colors-border-muted)' } }}
              >
                {isLoading ? (
                  <Flex bg="bg" justify="center" py={4}>
                    <Spinner size="sm" colorPalette="purple" />
                  </Flex>
                ) : savedFilters.length === 0 ? (
                  <Text bg="bg" px={3} py={3} fontSize="sm" color="fg.muted">
                    No saved filters yet. Build a filter and save it for quick reuse.
                  </Text>
                ) : (
                  savedFilters.map((savedFilter) => (
                    <Flex key={savedFilter.id}>
                      <PopoverMenuButton flex={1} minW={0} onClick={() => loadFilter(savedFilter)}>
                        <Flex align="center" gap={2} minW={0} w="full">
                          <Flex flexShrink={0} fontSize="sm" align="center">
                            {savedFilter.icon ? (
                              <CustomIconStyle transform="scale(0.8)">{savedFilter.icon}</CustomIconStyle>
                            ) : (
                              <Icon as={TbBookmark} color="fg.muted" />
                            )}
                          </Flex>
                          <Text fontSize="sm" truncate>
                            {savedFilter.name}
                          </Text>
                        </Flex>
                      </PopoverMenuButton>
                      <Flex bg="bg" flexShrink={0} align="center" gap={0.5} pl={1} pr={1.5} color="fg.muted">
                        <Tooltip content="Overwrite with current filters">
                          <IconButton
                            aria-label="Overwrite with current filters"
                            variant="ghost"
                            size="2xs"
                            disabled={!hasActiveFilters}
                            onClick={() => updateFilter({ projectId, id: savedFilter.id, filterConfig })}
                          >
                            <Icon as={TbDeviceFloppy} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip content="Rename">
                          <IconButton
                            aria-label="Rename"
                            variant="ghost"
                            size="2xs"
                            onClick={() => {
                              setPopoverOpen(false);
                              setDialog({ savedFilter });
                            }}
                          >
                            <Icon as={TbEdit} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip content="Delete">
                          <IconButton
                            aria-label="Delete"
                            variant="ghost"
                            size="2xs"
                            color="red.fg"
                            onClick={() => {
                              setPopoverOpen(false);
                              setDeleteTarget(savedFilter);
                            }}
                          >
                            <Icon as={TbTrash} />
                          </IconButton>
                        </Tooltip>
                      </Flex>
                    </Flex>
                  ))
                )}
              </Flex>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>

      <SaveFilterDialog
        projectId={projectId}
        filterConfig={filterConfig}
        savedFilter={dialog?.savedFilter}
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete saved filter"
        message={`Do you really want to delete "${deleteTarget?.name ?? ''}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          if (deleteTarget) {
            deleteFilter({ projectId, id: deleteTarget.id });
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};
