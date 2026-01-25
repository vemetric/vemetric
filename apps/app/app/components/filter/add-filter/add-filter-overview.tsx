import { Flex, Button } from '@chakra-ui/react';
import { PopoverMenuButton } from '~/components/popover-menu/popover-menu-button';
import { PopoverMenuHeader } from '~/components/popover-menu/popover-menu-header';
import type { RoutesWithFiltering } from '~/hooks/use-filters';
import { useFilters } from '~/hooks/use-filters';
import { useFilterContext } from '../filter-context';
import { ADD_FILTER_ITEMS } from './add-filters-items';

interface Props {
  from: RoutesWithFiltering;
  setFilterView: (view: string) => void;
  onClose: () => void;
}

export const AddFilterOverview = ({ from, setFilterView, onClose }: Props) => {
  const { removeAllFilters } = useFilters({ from });
  const filterContext = useFilterContext();

  // Filter out page filter if no page paths are available (e.g., on events page)
  const availableFilters = Object.entries(ADD_FILTER_ITEMS).filter(([key]) => {
    if (filterContext.disabledFilters?.includes(key as any)) {
      return false;
    }

    return true;
  });

  return (
    <>
      <PopoverMenuHeader title="Add Filter">
        <Button
          variant="surface"
          size="2xs"
          rounded="sm"
          onClick={() => {
            removeAllFilters();
            onClose();
          }}
        >
          Reset all
        </Button>
      </PopoverMenuHeader>
      <Flex
        flexDir="column"
        bg="purple.muted"
        roundedBottom="md"
        overflow="hidden"
        css={{
          '& > *:not(:last-child)': { borderBottom: '1px solid var(--chakra-colors-border-muted)' },
        }}
      >
        {availableFilters.map(([key, { title }]) => (
          <PopoverMenuButton
            key={key}
            onClick={() => {
              setFilterView(key);
            }}
          >
            {title}
          </PopoverMenuButton>
        ))}
      </Flex>
    </>
  );
};
