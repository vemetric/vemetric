import { Button, Flex, Icon, IconButton, Popover, Portal, Spinner, Text } from '@chakra-ui/react';
import type { IFilterConfig } from '@vemetric/common/filters';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { TbBookmark, TbCheck, TbDeviceFloppy, TbEdit, TbFilterPlus, TbPlus, TbTrash } from 'react-icons/tb';
import { isDeepEqual } from 'remeda';
import { ConfirmPopover } from '@/components/confirm-popover';
import { CustomIconStyle } from '@/components/custom-icon-style';
import { PopoverMenuButton } from '@/components/popover-menu/popover-menu-button';
import { PopoverMenuHeader } from '@/components/popover-menu/popover-menu-header';
import { EmptyState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { useProjectContext } from '@/contexts/project-context';
import type { RoutesWithFiltering } from '@/hooks/use-filters';
import { useFilters } from '@/hooks/use-filters';
import { trpc, type SavedFilterData } from '@/utils/trpc';
import { SaveFilterForm } from './save-filter-form';

const getMotionViewProps = (list?: boolean) => ({
  initial: { x: list ? '-100%' : '100%' },
  animate: { x: 0, transition: { duration: 0.2, bounce: 0 } },
  exit: { x: list ? '-100%' : '100%', transition: { duration: 0.2, bounce: 0 } },
});

interface Props {
  filterConfig: IFilterConfig;
  from: RoutesWithFiltering;
}

export const SavedFiltersButton = ({ filterConfig, from }: Props) => {
  const { projectId } = useProjectContext();
  const { setFilters, removeAllFilters } = useFilters({ from });
  const utils = trpc.useUtils();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  // null = the list view, otherwise the save/rename form (empty object = create, savedFilter set = rename).
  const [editing, setEditing] = useState<{ savedFilter?: SavedFilterData } | null>(null);

  const setView = (next: { savedFilter?: SavedFilterData } | null) => {
    setIsAnimating(true);
    setTimeout(() => {
      setEditing(next);
      setTimeout(() => setIsAnimating(false), 300);
    }, 1);
  };

  const { data, isLoading } = trpc.savedFilters.list.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const savedFilters = data?.savedFilters ?? [];
  const hasActiveFilters = (filterConfig?.filters.length ?? 0) > 0;

  const { mutate: updateFilter, isLoading: isUpdating } = trpc.savedFilters.update.useMutation({
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

  const { mutate: deleteFilter, isLoading: isDeleting } = trpc.savedFilters.delete.useMutation({
    onSuccess: () => {
      utils.savedFilters.list.invalidate();
      toaster.create({ title: 'Filter deleted', type: 'success' });
    },
    onError: (error) => {
      toaster.create({ title: 'Error', description: error.message || 'Failed to delete filter', type: 'error' });
    },
  });

  if (!projectId) {
    return null;
  }

  const toggleFilter = (savedFilter: SavedFilterData, isActive: boolean) => {
    if (isActive) {
      removeAllFilters();
    } else {
      setFilters(savedFilter.filterConfig);
    }
    setPopoverOpen(false);
  };

  const saveCurrentButtonProps = {
    disabled: !hasActiveFilters,
    onClick: () => setView({}),
  };

  return (
    <Popover.Root
      open={popoverOpen}
      onOpenChange={({ open }) => setPopoverOpen(open)}
      positioning={{ placement: 'bottom-end', gutter: 5 }}
      onExitComplete={() => setEditing(null)}
    >
      <Popover.Trigger asChild>
        <Button
          variant="surface"
          size={{ base: 'xs', md: 'sm' }}
          px={2}
          minW="0px"
          roundedLeft="none"
          border="1.5px dashed"
          borderLeftWidth="0px"
          borderColor={hasActiveFilters ? 'purple.500/80' : 'border.emphasized'}
          boxShadow="none"
          aria-label="Saved filters"
          _focusVisible={{ zIndex: 1 }}
        >
          <Icon as={TbBookmark} />
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content overflow={isAnimating ? 'hidden' : 'visible'}>
            <AnimatePresence initial={false} mode="popLayout">
              {editing === null ? (
                <motion.div key="list" {...getMotionViewProps(true)}>
                  <PopoverMenuHeader title="Saved filters">
                    <Tooltip content="You don't have active filters" disabled={hasActiveFilters}>
                      <Button variant="surface" size="2xs" rounded="sm" {...saveCurrentButtonProps}>
                        Save current
                      </Button>
                    </Tooltip>
                  </PopoverMenuHeader>
                  <Flex
                    flexDir="column"
                    bg="purple.muted"
                    roundedBottom="md"
                    overflow="hidden"
                    maxH="280px"
                    overflowY="auto"
                    css={{
                      '& > *:not(:last-child)': { borderBottom: '1px solid var(--chakra-colors-border-muted)' },
                    }}
                  >
                    {isLoading ? (
                      <Flex bg="bg" justify="center" py={4}>
                        <Spinner size="sm" colorPalette="purple" />
                      </Flex>
                    ) : savedFilters.length === 0 ? (
                      <EmptyState
                        bg="white"
                        icon={<TbFilterPlus />}
                        title="No saved filters yet"
                        description="Build a filter and save it for quick reuse."
                      >
                        <Tooltip content="You don't have active filters" disabled={hasActiveFilters}>
                          <Button
                            variant="surface"
                            size={{ base: 'xs', md: 'sm' }}
                            display={{ base: 'none', md: 'inline-flex' }}
                            {...saveCurrentButtonProps}
                          >
                            <Icon as={TbPlus} />
                            Save current
                          </Button>
                        </Tooltip>
                      </EmptyState>
                    ) : (
                      savedFilters.map((savedFilter) => {
                        const isActive = isDeepEqual(filterConfig, savedFilter.filterConfig);

                        return (
                          <Flex key={savedFilter.id}>
                            <PopoverMenuButton flex={1} minW={0} onClick={() => toggleFilter(savedFilter, isActive)}>
                              <Flex align="center" gap={2} minW={0} w="full">
                                <Flex flexShrink={0} fontSize="sm" align="center">
                                  {savedFilter.icon ? (
                                    <CustomIconStyle transform="scale(0.8)">{savedFilter.icon}</CustomIconStyle>
                                  ) : (
                                    <Icon as={TbBookmark} color={isActive ? 'purple.fg' : 'fg.muted'} />
                                  )}
                                </Flex>
                                <Text
                                  fontSize="sm"
                                  truncate
                                  flex={1}
                                  color={isActive ? 'purple.fg' : undefined}
                                  fontWeight={isActive ? 'medium' : undefined}
                                >
                                  {savedFilter.name}
                                </Text>
                                {isActive && <Icon as={TbCheck} flexShrink={0} color="purple.fg" />}
                              </Flex>
                            </PopoverMenuButton>
                            <Flex bg="bg" flexShrink={0} align="center" gap={0.5} pl={1} pr={1.5} color="fg.muted">
                              <ConfirmPopover
                                text="Overwrite this saved filter with your current filters?"
                                confirmText="Overwrite"
                                colorPalette="purple"
                                onConfirm={() => updateFilter({ projectId, id: savedFilter.id, filterConfig })}
                                isLoading={isUpdating}
                                placement="top"
                              >
                                <IconButton
                                  aria-label="Overwrite with current filters"
                                  variant="ghost"
                                  size="2xs"
                                  disabled={!hasActiveFilters}
                                >
                                  <Icon as={TbDeviceFloppy} />
                                </IconButton>
                              </ConfirmPopover>
                              <Tooltip content="Edit">
                                <IconButton
                                  aria-label="Edit"
                                  variant="ghost"
                                  size="2xs"
                                  onClick={() => setView({ savedFilter })}
                                >
                                  <Icon as={TbEdit} />
                                </IconButton>
                              </Tooltip>
                              <ConfirmPopover
                                text="Do you really want to delete this saved filter?"
                                onConfirm={() => deleteFilter({ projectId, id: savedFilter.id })}
                                isLoading={isDeleting}
                                placement="top"
                              >
                                <IconButton aria-label="Delete" variant="ghost" size="2xs" color="red.fg">
                                  <Icon as={TbTrash} />
                                </IconButton>
                              </ConfirmPopover>
                            </Flex>
                          </Flex>
                        );
                      })
                    )}
                  </Flex>
                </motion.div>
              ) : (
                <motion.div key="form" {...getMotionViewProps()}>
                  <SaveFilterForm
                    projectId={projectId}
                    filterConfig={filterConfig}
                    savedFilter={editing.savedFilter}
                    onBack={() => setView(null)}
                    onSuccess={() => setView(null)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
