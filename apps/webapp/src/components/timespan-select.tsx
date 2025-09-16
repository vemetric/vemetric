import { Button, ButtonGroup, Flex, Popover, Portal, Icon } from '@chakra-ui/react';
import { getRouteApi, Navigate, useParams, useRouter } from '@tanstack/react-router';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import {
  formatTimeSpanDateValue,
  isTimespanAllowed,
  parseTimeSpanDateValue,
  TIME_SPAN_DATA,
} from '@vemetric/common/charts/timespans';
import { addDays, isBefore } from 'date-fns';
import { TbCalendar, TbChevronDown } from 'react-icons/tb';
import {
  MenuContent,
  MenuItem,
  MenuRadioItem,
  MenuRadioItemGroup,
  MenuRoot,
  MenuTrigger,
  MenuSeparator,
} from '@/components/ui/menu';
import type { TimespanRoute } from '@/hooks/use-timespan-param';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { formatTimeSpanDateRange } from '@/utils/timespans';
import { trpc } from '@/utils/trpc';
import { DateRangePicker } from './ui/date-range-picker/date-range-picker';
import { Status } from './ui/status';
import { Tooltip } from './ui/tooltip';

const today = new Date();
export const todayMinus31Days = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), -31);

interface Props {
  from: TimespanRoute;
  excludeLive?: boolean;
}

export const TimespanSelect = ({ from, excludeLive = false }: Props) => {
  const router = useRouter();
  const route = getRouteApi(from);

  const { projectId, domain } = useParams({ strict: false });
  const navigate = route.useNavigate();
  const { timespan, startDate, endDate } = useTimespanParam({ from });

  const { data, isLoading } = trpc.billing.subscriptionActive.useQuery({ domain, projectId });

  if (excludeLive && timespan === 'live') {
    return <Navigate from={router.routesById[route.id].fullPath} search={{ t: '24hrs' }} replace />;
  }

  let isAllowed = isTimespanAllowed(timespan, Boolean(data?.isSubscriptionActive));
  if (timespan === 'custom' && startDate && !data?.isSubscriptionActive) {
    const parsedStartDate = parseTimeSpanDateValue(startDate);
    const startDateObj = new Date(parsedStartDate.year, parsedStartDate.month - 1, parsedStartDate.day);
    isAllowed = !isBefore(startDateObj, todayMinus31Days);
  }

  if (!isLoading && !isAllowed) {
    return <Navigate from={router.routesById[route.id].fullPath} search={{ t: '30days' }} replace />;
  }

  const timeSpanData = TIME_SPAN_DATA[timespan];
  const getCustomTimespanLabel = () => {
    if (timespan === 'custom' && startDate) {
      if (endDate && startDate !== endDate) {
        return formatTimeSpanDateRange(startDate, endDate);
      }
      return formatTimeSpanDateRange(startDate);
    }
    return '';
  };

  return (
    <Popover.Root lazyMount unmountOnExit>
      <Popover.Context>
        {({ setOpen }) => (
          <ButtonGroup attached variant="surface" size={{ base: 'xs', md: 'sm' }}>
            <Popover.Trigger asChild>
              <Button px={2.5} roundedRight="none" _focusVisible={{ zIndex: 1 }}>
                <TbCalendar />
                {getCustomTimespanLabel()}
              </Button>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content rounded="lg" overflow="hidden">
                  <DateRangePicker
                    minDate={data?.isSubscriptionActive ? undefined : todayMinus31Days}
                    minRangeDisabledTooltip="Upgrade to the Professional plan for longer data retention."
                    value={
                      timespan === 'custom' && startDate
                        ? {
                            start: parseTimeSpanDateValue(startDate),
                            end: endDate ? parseTimeSpanDateValue(endDate) : parseTimeSpanDateValue(startDate),
                          }
                        : null
                    }
                    onRangeSelect={({ start, end }) => {
                      const sd = formatTimeSpanDateValue(start);
                      const ed = formatTimeSpanDateValue(end);

                      navigate({
                        resetScroll: false,
                        search: (prev) => ({
                          ...prev,
                          t: 'custom',
                          sd: formatTimeSpanDateValue(start),
                          ed: sd !== ed ? ed : undefined,
                        }),
                      });
                      setOpen(false);
                    }}
                    enableMonthRangeSelection
                  />
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
            <MenuRoot positioning={{ placement: 'bottom-end' }}>
              <MenuTrigger asChild>
                <Button roundedLeft="none" minW="20px" px={timespan === 'custom' ? 1.5 : 2.5}>
                  {timespan === 'live' && <Status value="success" color="fg" gap={1.5} />}{' '}
                  {timespan === 'custom' ? <TbChevronDown /> : timeSpanData.label}
                </Button>
              </MenuTrigger>
              <MenuContent minW="10rem">
                <MenuRadioItemGroup
                  value={timespan}
                  onValueChange={({ value }) => {
                    navigate({
                      resetScroll: false,
                      search: (prev) => ({ ...prev, t: String(value) as TimeSpan, sd: undefined, ed: undefined }),
                    });
                  }}
                >
                  {Object.entries(TIME_SPAN_DATA)
                    .filter(([key]) => !excludeLive || key !== 'live')
                    .filter(([key]) => key !== 'custom')
                    .map(([key, value]) => {
                      const isDisabled = !isTimespanAllowed(key as TimeSpan, Boolean(data?.isSubscriptionActive));

                      return (
                        <Tooltip
                          key={key}
                          contentProps={{ maxW: '230px' }}
                          content="Upgrade to the Professional plan for longer data retention."
                          disabled={!isDisabled}
                        >
                          <MenuRadioItem value={key} disabled={isDisabled}>
                            <Flex alignItems="center" gap={2}>
                              {value.label}
                              {key === 'live' ? <Status value="success" color="fg" gap={1.5} /> : null}
                            </Flex>
                          </MenuRadioItem>
                        </Tooltip>
                      );
                    })}
                  <MenuSeparator my="0" />
                  <MenuItem
                    value="custom"
                    pl="2.5"
                    onClick={() => {
                      setOpen(true);
                    }}
                  >
                    <Icon as={TbCalendar} />
                    Custom
                  </MenuItem>
                </MenuRadioItemGroup>
              </MenuContent>
            </MenuRoot>
          </ButtonGroup>
        )}
      </Popover.Context>
    </Popover.Root>
  );
};
