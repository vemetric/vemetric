import { Button, Icon, Badge, Portal, Popover } from '@chakra-ui/react';
import { type IFilterConfig } from '@vemetric/common/filters';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { TbFilterPlus } from 'react-icons/tb';
import { PopoverMenuHeader } from '@/components/popover-menu/popover-menu-header';
import { useFilters } from '@/hooks/use-filters';
import { ADD_FILTERS, AddFilterOverview } from './add-filter-overview';
import { OPERATOR_BUTTON_MENU_CLASS_NAME } from '../operator-button';

const getMotionViewProps = (overview?: boolean) => ({
  initial: { x: overview ? '-100%' : '100%' },
  animate: { x: 0, transition: { duration: 0.2, bounce: 0 } },
  exit: { x: overview ? '-100%' : '100%', transition: { duration: 0.2, bounce: 0 } },
});

interface Props {
  filterConfig: IFilterConfig;
  from: '/p/$projectId' | '/p/$projectId/users' | '/public/$domain';
}

export const AddFilterButton = ({ filterConfig, from }: Props) => {
  const { setFilters } = useFilters({ from });
  const [isAnimating, setIsAnimating] = useState(false);
  const [filterView, _setFilterView] = useState<string | null>(null);
  const filterCount = filterConfig?.filters.length ?? 0;
  const [popoverOpen, setPopoverOpen] = useState(false);

  const setFilterView = (view: string | null) => {
    setIsAnimating(true);
    setTimeout(() => {
      _setFilterView(view);
      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    }, 1);
  };

  const onBack = () => {
    setFilterView(null);
  };
  const onClose = () => {
    setPopoverOpen(false);
  };

  return (
    <Popover.Root
      persistentElements={[
        () => {
          return document.querySelector(`.${OPERATOR_BUTTON_MENU_CLASS_NAME}`);
        },
      ]}
      open={popoverOpen}
      onOpenChange={({ open }) => {
        setPopoverOpen(open);
      }}
      positioning={{ placement: 'bottom-end', gutter: 5 }}
      onExitComplete={() => {
        setFilterView(null);
      }}
    >
      <Popover.Trigger asChild>
        <Button
          variant="surface"
          px={2}
          size={{ base: 'xs', md: 'sm' }}
          border="1.5px dashed"
          borderColor={filterCount === 0 ? 'border.emphasized' : 'purple.500/80'}
          boxShadow="none"
          _expanded={{
            bg: 'bg.card',
          }}
        >
          <Icon
            as={TbFilterPlus}
            color={filterCount === 0 ? undefined : 'purple.500'}
            transition="color 0.2s ease-out"
          />{' '}
          Filter
          {filterCount > 0 && <Badge fontSize="xs">{filterCount}</Badge>}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content overflow={isAnimating ? 'hidden' : 'visible'}>
            <AnimatePresence initial={false} mode="popLayout">
              {filterView === null && (
                <motion.div key="overview" {...getMotionViewProps(true)}>
                  <AddFilterOverview from={from} setFilterView={setFilterView} onClose={onClose} />
                </motion.div>
              )}
              {Object.entries(ADD_FILTERS).map(([key, { title, filterForm: FilterForm }]) => {
                if (filterView !== key) {
                  return null;
                }

                return (
                  <motion.div key={key} {...getMotionViewProps()}>
                    <PopoverMenuHeader title={title} onBack={onBack} />
                    <FilterForm
                      onSubmit={(filter) => {
                        setFilters((prev) => {
                          return prev
                            ? {
                                ...prev,
                                filters: [...(prev?.filters ?? []), filter],
                              }
                            : {
                                filters: [filter],
                                operator: 'and',
                              };
                        });
                        onClose();
                      }}
                      buttonText="Add"
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
