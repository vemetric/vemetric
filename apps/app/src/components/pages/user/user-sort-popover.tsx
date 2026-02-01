import { Flex, Button, Popover, Portal, Text } from '@chakra-ui/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { TbEye, TbBolt } from 'react-icons/tb';
import { EventFilterForm } from '@/components/filter/filter-forms/event-filter-form';
import { PopoverMenuButton } from '@/components/popover-menu/popover-menu-button';
import { PopoverMenuHeader } from '@/components/popover-menu/popover-menu-header';

const getMotionViewProps = (overview?: boolean) => ({
  initial: { x: overview ? '-100%' : '100%' },
  animate: { x: 0, transition: { duration: 0.2, bounce: 0 } },
  exit: { x: overview ? '-100%' : '100%', transition: { duration: 0.2, bounce: 0 } },
});

export const UserSortPopover = () => {
  const { s: sortConfig } = useSearch({ from: '/_layout/p/$projectId/users/' });
  const navigate = useNavigate({ from: '/p/$projectId/users' });

  const [isAnimating, setIsAnimating] = useState(false);
  const [filterView, _setFilterView] = useState<string | null>(null);
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
          variant="ghost"
          size="sm"
          px={2}
          py={0.5}
          mx={-2}
          my={-0.5}
          h="auto"
          color="fg"
          _hover={{ bg: 'transparent', outline: '1px solid', outlineColor: 'gray.emphasized' }}
        >
          {sortConfig?.by?.type === 'event' ? (
            <Text as="span" display="contents" color="purple.fg">
              <TbBolt /> Last fired event
            </Text>
          ) : (
            'Last seen'
          )}
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content overflow={isAnimating ? 'hidden' : 'visible'}>
            <AnimatePresence initial={false} mode="popLayout">
              {filterView === null && (
                <motion.div key="overview" {...getMotionViewProps(true)}>
                  <Flex
                    flexDir="column"
                    bg="purple.muted"
                    rounded="md"
                    overflow="hidden"
                    css={{
                      '& > *:not(:last-child)': {
                        borderBottom: '1px solid var(--chakra-colors-border-muted)',
                      },
                    }}
                  >
                    <PopoverMenuButton
                      onClick={() => {
                        navigate({ search: (prev) => ({ ...prev, s: undefined }) });
                        onClose();
                      }}
                    >
                      <TbEye /> Last seen
                    </PopoverMenuButton>
                    <PopoverMenuButton
                      onClick={() => {
                        setFilterView('event');
                      }}
                    >
                      <TbBolt /> Last fired event
                    </PopoverMenuButton>
                  </Flex>
                </motion.div>
              )}
              {filterView === 'event' && (
                <motion.div {...getMotionViewProps()}>
                  <PopoverMenuHeader
                    title={
                      <>
                        <TbBolt />
                        Sort by last fired event
                      </>
                    }
                    onBack={onBack}
                  />
                  <EventFilterForm
                    filter={sortConfig?.by}
                    onSubmit={(sortBy) => {
                      navigate({ search: (prev) => ({ ...prev, s: { by: sortBy } }) });
                      onClose();
                    }}
                    buttonText="Sort by"
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
