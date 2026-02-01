import { Flex, type FlexProps, Text } from '@chakra-ui/react';
import { filterGroupOperatorValues, type IFilter, type IFilterGroup } from '@vemetric/common/filters';
import { produce } from 'immer';
import { AnimatePresence, motion } from 'motion/react';
import { FilterButton } from './filter-button';
import { BrowserFilterButton } from './filter-buttons/browser-filter-button';
import { DeviceFilterButton } from './filter-buttons/device-filter-button';
import { EventFilterButton } from './filter-buttons/event-filter-button';
import { FunnelFilterButton } from './filter-buttons/funnel-filter-button';
import { LocationFilterButton } from './filter-buttons/location-filter-button';
import { OsFilterButton } from './filter-buttons/os-filter-button';
import { PageFilterButton } from './filter-buttons/page-filter-button';
import { ReferrerFilterButton } from './filter-buttons/referrer-filter-button';
import { ReferrerTypeFilterButton } from './filter-buttons/referrer-type-filter-button';
import { ReferrerUrlFilterButton } from './filter-buttons/referrer-url-filter-button';
import { UserFilterButton } from './filter-buttons/user-filter-button';
import { UtmTagsFilterButton } from './filter-buttons/utm-tags-filter-button';
import { OperatorButton } from './operator-button';

interface Props extends Omit<FlexProps, 'onChange'> {
  group: IFilterGroup;
  onChange: (group: IFilterGroup) => void;
  onDelete: () => void;
  nested: boolean;
}

export const FilterGroup = ({ group, onChange, onDelete: onDeleteGroup, nested, ...props }: Props) => {
  return (
    <Flex
      align="center"
      justify="flex-start"
      gap={0.5}
      pos="relative"
      flexWrap="wrap"
      rowGap={1.5}
      {...(nested
        ? {
            border: '1.5px dashed',
            borderColor: 'border.emphasized',
            p: 1.5,
            rounded: 'lg',
            bg: 'bg.card',
          }
        : { px: '1px' })}
      {...props}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {group.filters.map((filter, index) => {
          let component: React.ReactNode = null;
          const onDeleteFilter = () => {
            if (group.filters.length === 1) {
              onDeleteGroup();
              return;
            }

            onChange(
              produce(group, (draft) => {
                draft.filters.splice(index, 1);
              }),
            );
          };

          const onChangeFilter = (newFilter: IFilter) => {
            onChange(
              produce(group, (draft) => {
                draft.filters[index] = newFilter;
              }),
            );
          };

          switch (filter.type) {
            case 'group':
              component = (
                <FilterGroup
                  group={filter}
                  onChange={(newGroup) => {
                    onChange(
                      produce(group, (draft) => {
                        draft.filters[index] = newGroup;
                      }),
                    );
                  }}
                  onDelete={onDeleteFilter}
                  nested
                />
              );
              break;
            default: {
              switch (filter.type) {
                case 'page':
                  component = <PageFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />;
                  break;
                case 'event':
                  component = <EventFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />;
                  break;
                case 'user':
                  component = <UserFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />;
                  break;
                case 'location':
                  component = (
                    <LocationFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />
                  );
                  break;
                case 'referrer':
                  component = (
                    <ReferrerFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />
                  );
                  break;
                case 'referrerUrl':
                  component = (
                    <ReferrerUrlFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />
                  );
                  break;
                case 'referrerType':
                  component = (
                    <ReferrerTypeFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />
                  );
                  break;
                case 'utmTags':
                  component = (
                    <UtmTagsFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />
                  );
                  break;
                case 'browser':
                  component = (
                    <BrowserFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />
                  );
                  break;
                case 'device':
                  component = (
                    <DeviceFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />
                  );
                  break;
                case 'os':
                  component = <OsFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />;
                  break;
                case 'funnel':
                  component = (
                    <FunnelFilterButton filter={filter} onChange={onChangeFilter} onDelete={onDeleteFilter} />
                  );
                  break;
                default:
                  component = (
                    <FilterButton filter={filter} onDelete={onDeleteFilter}>
                      <Text color="fg.error" fontWeight="medium">
                        Unknown
                      </Text>
                    </FilterButton>
                  );
                  break;
              }
            }
          }

          return (
            <motion.div
              layout
              style={{ display: 'flex' }}
              key={index + JSON.stringify(filter)}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10, transition: { duration: 0.1 } }}
            >
              <Flex align="center" gap={0.5} flexShrink={0}>
                {index !== 0 && (
                  <OperatorButton
                    variant="ghost"
                    operator={group.operator}
                    operators={filterGroupOperatorValues}
                    onChange={(operator) => {
                      onChange({ ...group, operator });
                    }}
                    portalled
                  >
                    {group.operator === 'and' ? '&' : 'or'}
                  </OperatorButton>
                )}
                {component}
              </Flex>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Flex>
  );
};
