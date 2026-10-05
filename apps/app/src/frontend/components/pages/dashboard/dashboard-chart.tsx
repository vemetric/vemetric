import type { CardRootProps } from '@chakra-ui/react';
import { Card, AspectRatio, Box, Flex, SimpleGrid, Text, useBreakpointValue } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import type { ChartInterval, TimeSpan } from '@vemetric/common/charts/timespans';
import { getCustomDateRangeInterval, isIncompletePeriod, TIME_SPAN_DATA } from '@vemetric/common/charts/timespans';
import type { IFilterConfig } from '@vemetric/common/filters';
import { formatNumber } from '@vemetric/common/math';
import { isSameDay } from 'date-fns';
import type React from 'react';
import { useMemo, useState } from 'react';
import { TbActivity } from 'react-icons/tb';
import { DataEmptyState } from '@/components/data-empty-state';
import { DeleteIconButton } from '@/components/delete-icon-button';
import type { ChartCategory } from '@/components/pages/dashboard/chart-category-card';
import {
  CHART_CATEGORIES,
  CHART_CATEGORY_MAP,
  ChartCategoryCard,
} from '@/components/pages/dashboard/chart-category-card';
import { DashboardCardHeader } from '@/components/pages/dashboard/dashboard-card-header';
import { MenuContent, MenuRoot, MenuTrigger, MenuItem } from '@/components/ui/menu';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import type { ChartCategoryKey } from '@/hooks/use-chart-toggles';
import { useChartToggles } from '@/hooks/use-chart-toggles';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import type { TrendsData } from '@/utils/trends';
import type { DashboardData } from '@/utils/trpc';
import { TimeSeriesChart } from './time-series-chart';

// Reveals the series when they appear in the live view
const LIVE_REVEAL = { duration: 1500 };

export const getTimespanInterval = (timespan: TimeSpan, _startDate?: string, _endDate?: string) => {
  const timeSpanData = TIME_SPAN_DATA[timespan];
  if (timespan === 'custom' && _startDate) {
    const startDate = new Date(_startDate + 'T00:00:00Z');
    const endDate = _endDate ? new Date(_endDate + 'T23:59:59Z') : new Date(_startDate + 'T23:59:59Z');
    return getCustomDateRangeInterval(startDate, endDate);
  }
  return timeSpanData.interval;
};

export function transformChartSeries(
  data: DashboardData['chartTimeSeries'] | null | undefined,
  interval: ChartInterval,
  timespan: TimeSpan,
) {
  if (!data || data.length === 0) {
    return [];
  }

  const firstStartTime = new Date(data[0].date);
  const lastStartTime = new Date(data[data.length - 1].date);
  const spansMultipleYears = firstStartTime.getUTCFullYear() !== lastStartTime.getUTCFullYear();

  // Find the index where incomplete data starts
  let incompleteStartIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (isIncompletePeriod(new Date(data[i].date), interval)) {
      incompleteStartIndex = i;
      break;
    }
  }

  return data.map((entry, index) => {
    const startDate = new Date(entry.date);
    const endDate = new Date(startDate);

    let formatMethod: keyof typeof dateTimeFormatter = 'formatTime';
    switch (interval) {
      case 'thirty_seconds':
        formatMethod = 'formatTimeWithSeconds';
        endDate.setSeconds(startDate.getSeconds() + 29);
        break;
      case 'ten_minutes':
        endDate.setMinutes(startDate.getMinutes() + 9);
        break;
      case 'hourly':
        if (timespan === 'custom' && !isSameDay(firstStartTime, lastStartTime)) {
          formatMethod = 'formatDateTimeShort';
        }

        endDate.setMinutes(startDate.getMinutes() + 59);
        break;
      case 'daily':
        formatMethod = 'formatDate';
        endDate.setHours(startDate.getHours() + 23);
        break;
      case 'weekly':
        formatMethod = 'formatWeek';
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'monthly': {
        if (timespan === '1year' || spansMultipleYears) {
          formatMethod = 'formatMonthYear';
        } else {
          formatMethod = 'formatMonth';
        }
        endDate.setDate(startDate.getDate() + 30);
        break;
      }
    }

    const isIncomplete = incompleteStartIndex !== -1 && index >= incompleteStartIndex;
    // The transition point is the last complete data point - it appears in both solid and dashed series
    const isTransitionPoint = incompleteStartIndex !== -1 && index === incompleteStartIndex - 1;

    return {
      startDate: dateTimeFormatter[formatMethod](startDate),
      endDate: dateTimeFormatter[formatMethod](endDate),
      events: entry.events,

      // Full values: always present, used for background gradient area (consistent scaling)
      usersFull: entry.users,
      pageViewsFull: entry.pageViews,
      bounceRateFull: entry.bounceRate,
      visitDurationFull: entry.visitDuration,

      // Solid values: show for complete data and transition point
      users: !isIncomplete || isTransitionPoint ? entry.users : null,
      pageViews: !isIncomplete || isTransitionPoint ? entry.pageViews : null,
      bounceRate: !isIncomplete || isTransitionPoint ? entry.bounceRate : null,
      visitDuration: !isIncomplete || isTransitionPoint ? entry.visitDuration : null,

      // Dashed values: show for incomplete data and transition point (for visual continuity)
      usersDashed: isIncomplete || isTransitionPoint ? entry.users : null,
      pageViewsDashed: isIncomplete || isTransitionPoint ? entry.pageViews : null,
      bounceRateDashed: isIncomplete || isTransitionPoint ? entry.bounceRate : null,
      visitDurationDashed: isIncomplete || isTransitionPoint ? entry.visitDuration : null,
    };
  });
}

interface Props extends CardRootProps {
  timespan: TimeSpan;
  timespanStartDate?: string;
  timespanEndDate?: string;
  data: DashboardData;
  trends?: TrendsData;
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  allowDecimals?: boolean;
  tickGap?: number;
  publicDashboard?: boolean;
  filterConfig?: IFilterConfig;
}

export const DashboardChart = (props: Props) => {
  const {
    data,
    trends,
    timespan,
    timespanStartDate,
    timespanEndDate,
    autoMinValue = false,
    minValue,
    maxValue,
    allowDecimals = true,
    publicDashboard = false,
    filterConfig,
    ...cardProps
  } = props;
  const isMobile = useBreakpointValue({ base: true, md: false });
  const navigate = useNavigate({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });
  const { activeCategoryKeys, showEvents, toggleCategory } = useChartToggles({
    publicDashboard,
  });

  const timeSpanInterval = getTimespanInterval(timespan, timespanStartDate, timespanEndDate);
  const showEndDate = timeSpanInterval === 'ten_minutes' || timeSpanInterval === 'hourly';
  const chartData = useMemo(
    () => transformChartSeries(data.chartTimeSeries ?? [], timeSpanInterval, timespan),
    [data.chartTimeSeries, timeSpanInterval, timespan],
  );

  const [activeMobileCategory, setActiveMobileCategory] = useState<ChartCategoryKey>('users');

  const handleToggleCategory = (category: ChartCategoryKey) => {
    if (isMobile) {
      return;
    }
    toggleCategory(category);
  };

  const handleLiveClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    navigate({ search: (prev) => ({ ...prev, t: 'live' }), params: (prev) => prev });
  };

  const eventCategory = CHART_CATEGORY_MAP.events;
  const activeCategories = useMemo(
    () =>
      CHART_CATEGORIES.filter(
        (entry): entry is [Exclude<ChartCategoryKey, 'events'>, ChartCategory] =>
          entry[0] !== 'events' &&
          (isMobile ? activeMobileCategory === entry[0] : activeCategoryKeys.includes(entry[0])),
      ),
    [isMobile, activeMobileCategory, activeCategoryKeys],
  );
  const onlineUsers = formatNumber(data?.currentActiveUsers ?? 0, true);

  return (
    <Card.Root {...cardProps}>
      <DashboardCardHeader p={1.5} pb={1.5}>
        <MenuRoot positioning={{ sameWidth: true }}>
          <MenuTrigger disabled={!isMobile} asChild>
            <SimpleGrid columns={{ base: 1, md: 4 }} w="100%">
              {CHART_CATEGORIES.filter(([key]) => key !== 'events').map(([_categoryKey], index) => {
                const categoryKey = _categoryKey as Exclude<ChartCategoryKey, 'events'>;
                return (
                  <Flex key={categoryKey} gap={1.5}>
                    {index > 0 && (
                      <Box display={{ base: 'none', md: 'block' }} w="1.5px" h="100%" bg="gray.emphasized/50" />
                    )}
                    <ChartCategoryCard
                      categoryKey={categoryKey}
                      display={{ base: activeMobileCategory === categoryKey ? 'flex' : 'none', md: 'flex' }}
                      mr={{ base: 0, md: index === CHART_CATEGORIES.length - 1 ? 0 : 1.5 }}
                      value={data?.[categoryKey]}
                      trend={trends?.[categoryKey]}
                      isActive={isMobile || activeCategoryKeys.includes(categoryKey)}
                      onClick={() => handleToggleCategory(categoryKey)}
                      label={
                        categoryKey === 'users' ? (
                          <Tooltip content={`${onlineUsers} users are currently online`}>
                            <Status value="success" color="fg" gap={1.5} onClick={handleLiveClick}>
                              <Text fontWeight="semibold">{onlineUsers}</Text>
                            </Status>
                          </Tooltip>
                        ) : undefined
                      }
                    />
                  </Flex>
                );
              })}
            </SimpleGrid>
          </MenuTrigger>
          <MenuContent w="100%">
            <Card.Root flexDir="column" gap={2.5} p={2} bg="gray.subtle">
              {CHART_CATEGORIES.filter(([key]) => key !== 'events').map(([_categoryKey]) => {
                const categoryKey = _categoryKey as Exclude<ChartCategoryKey, 'events'>;

                return (
                  <MenuItem key={categoryKey} value={categoryKey} asChild alignItems="stretch">
                    <ChartCategoryCard
                      categoryKey={categoryKey}
                      mr={{ base: 0, md: 1.5 }}
                      value={data?.[categoryKey]}
                      trend={trends?.[categoryKey]}
                      isActive
                      bg="bg.card"
                      onClick={() => setActiveMobileCategory(categoryKey)}
                    />
                  </MenuItem>
                );
              })}
            </Card.Root>
          </MenuContent>
        </MenuRoot>
      </DashboardCardHeader>
      <Card.Body p="2.5" pos="relative">
        {showEvents && (
          <Flex
            className="group"
            align="center"
            pos="absolute"
            right="2.5"
            top="2.5"
            bg="bg.card"
            borderColor="gray.emphasized"
            borderWidth={1}
            borderRadius="md"
            p={1}
            gap={1}
            zIndex="1"
          >
            <Box w={2} h={2} bg={`${eventCategory.color}.500`} rounded="full" />
            <Text fontSize="xs" fontWeight="semibold">
              {data?.events.reduce((acc, curr) => acc + curr.count, 0) || 0} Events
            </Text>
            <DeleteIconButton onClick={() => handleToggleCategory('events')} />
          </Flex>
        )}
        {data.chartTimeSeries.length > 0 ? (
          <AspectRatio pos="relative" w="100%" ratio={{ base: 9 / 3.5, md: 9 / 3 }}>
            <Box pos="absolute" inset={0}>
              <TimeSeriesChart
                data={chartData}
                categories={activeCategories}
                showEvents={showEvents}
                showEndDate={showEndDate}
                reveal={timespan === 'live' ? LIVE_REVEAL : undefined}
                animateUpdates={timespan === 'live'}
                hideYAxis={!!isMobile}
                autoMinValue={autoMinValue}
                minValue={minValue}
                maxValue={maxValue}
                allowDecimals={allowDecimals}
              />
            </Box>
          </AspectRatio>
        ) : (
          // CSS aspect-ratio (unlike AspectRatio) lets the box grow when the content doesn't fit on small screens
          <Flex w="100%" aspectRatio={{ base: 9 / 3.5, md: 9 / 3 }} justify="center" align="center">
            <DataEmptyState
              size={{ base: 'sm', md: 'md' }}
              icon={<TbActivity />}
              title="No data available"
              description="Adjust the current filters or timeframe to explore a different slice of data."
              filterConfig={filterConfig}
              filterRoute={publicDashboard ? '/public/$domain' : '/p/$projectId'}
              timespanRoute={publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/'}
            />
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  );
};
