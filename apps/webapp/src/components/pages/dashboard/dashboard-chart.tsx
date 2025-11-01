import type { CardRootProps } from '@chakra-ui/react';
import { Card, Icon, AspectRatio, Box, Flex, SimpleGrid, Text, useBreakpointValue } from '@chakra-ui/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { formatNumber } from '@vemetric/common/math';
import React, { useState } from 'react';
import {
  Area,
  Dot,
  ComposedChart as RechartsComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
} from 'recharts';
import type { AxisDomain } from 'recharts/types/util/types';
import type { ChartCategoryKey } from '@/components/pages/dashboard/chart-category-card';
import {
  CHART_CATEGORIES,
  CHART_CATEGORY_MAP,
  ChartCategoryCard,
} from '@/components/pages/dashboard/chart-category-card';
import { DashboardCardHeader } from '@/components/pages/dashboard/dashboard-card-header';
import { MenuContent, MenuRoot, MenuTrigger, MenuItem } from '@/components/ui/menu';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import type { DashboardData } from '@/utils/trpc';
import { DashboardChartDataMissing } from './charts/chart-missing-data';
import { getTimespanInterval, getYAxisDomain, transformChartSeries } from './charts/chart-helpers';
// import { DashboardChartEventCounter } from './charts/chart-event-counter';
import { DeleteIconButton } from '@/components/delete-icon-button';

// ========================================================= //
// ================= Props / Types ========================= //
// ========================================================= //
export type ChartPayloadItem = {
  categoryKey: string;
  value: number;
  color: string;
  type?: string;
  payload: any;
};

interface Props extends CardRootProps {
  timespan: TimeSpan;
  timespanStartDate?: string;
  timespanEndDate?: string;
  data: DashboardData;
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  allowDecimals?: boolean;
  tickGap?: number;
  connectNulls?: boolean;
  publicDashboard?: boolean;
}

// ========================================================= //
// ==================== Main Component ===================== //
// ========================================================= //
export const DashboardChart = (props: Props) => {
  const {
    data,
    timespan,
    timespanStartDate,
    timespanEndDate,
    autoMinValue = false,
    minValue,
    maxValue,
    allowDecimals = true,
    connectNulls = false,
    publicDashboard = false,
    ...cardProps
  } = props;
  const areaId = React.useId();

  const { e: showEvents } = useSearch({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const navigate = useNavigate({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const handleLiveClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    navigate({ search: (prev) => ({ ...prev, t: 'live' }) });
  };

  const handleClearEventCounter = () => {
    navigate({ search: (prev) => ({ ...prev, e: undefined }), resetScroll: false });
  };

  const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
  const timeSpanInterval = getTimespanInterval(timespan, timespanStartDate, timespanEndDate);
  const chartData = transformChartSeries(data.chartTimeSeries ?? [], timeSpanInterval, timespan);
  const showEndDate = timeSpanInterval === 'ten_minutes' || timeSpanInterval === 'hourly';

  const isMobile = useBreakpointValue({ base: true, md: false });
  const [activeMobileCategory, setActiveMobileCategory] = useState<ChartCategoryKey>('users');
  const [activeCategoryKeys, setActiveCategoryKeys] = useState<Array<ChartCategoryKey>>(['users', 'pageViews']);

  // ========================================================= //
  // ======================= Handlers ======================== //
  // ========================================================= //
  const toggleCategory = (category: ChartCategoryKey) => {
    if (isMobile) return;

    setActiveCategoryKeys((prev) => {
      if (prev.length === 1 && prev[0] === category) return prev;

      return prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category];
    });
  };

  const eventCategory = CHART_CATEGORY_MAP.events;
  const eventCategoryColor = eventCategory.color;
  const eventCount = data?.events.reduce((acc, curr) => acc + curr.count, 0) || 0;
  const onlineUsers = formatNumber(data?.currentActiveUsers ?? 0, true);

  const activeCategories = CHART_CATEGORIES.filter(([key]) =>
    isMobile ? activeMobileCategory === key : activeCategoryKeys.includes(key as ChartCategoryKey),
  );

  // ========================================================= //
  // =================== Sub-Components ====================== //
  // ========================================================= //
  const _eventCounterDisplay = () => {
    return (
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
        <Box w={2} h={2} bg={`${eventCategoryColor}.500`} rounded="full" />
        <Text fontSize="xs" fontWeight="semibold">
          {eventCount} Events
        </Text>
        <DeleteIconButton onClick={handleClearEventCounter} />
      </Flex>
    );
  };

  const _BarChartVisuals = () => {
    return (
      <>
        <defs>
          <linearGradient
            style={{ color: `var(--chakra-colors-${eventCategoryColor}-400)` }}
            id="events"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="5%" stopColor="currentColor" stopOpacity={1} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <Bar
          style={{ stroke: `var(--chakra-colors-${eventCategoryColor}-500)` }}
          name="events"
          type="linear"
          yAxisId="events"
          dataKey="events"
          stroke=""
          strokeOpacity={0.6}
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
          isAnimationActive={true}
          radius={[3, 3, 0, 0]}
          fill={`url(#events)`}
        />
      </>
    );
  };

  // const _AreaChartVisuals = () => {};

  const _xAxisSetup = () => {
    <XAxis
      dataKey="startDate"
      interval="preserveStartEnd"
      tick={{ transform: 'translate(0, 6)' }}
      padding={{ left: 10, right: 90 }}
      fill=""
      stroke=""
      tickLine={false}
      axisLine={true}
      minTickGap={15}
      scale="point"
    />;
  };

  const _yAxisSetup = () => {
    return (
      <>
        <YAxis
          yAxisId="other"
          type="number"
          domain={yAxisDomain as AxisDomain}
          allowDecimals={allowDecimals}
          axisLine={false}
          tickLine={false}
          width={40}
          tickFormatter={(value) => formatNumber(value, true)}
          hide={isMobile}
        />
        <YAxis
          yAxisId="bounceRate"
          hide
          type="number"
          domain={yAxisDomain as AxisDomain}
          allowDecimals={allowDecimals}
        />
        <YAxis
          yAxisId="visitDuration"
          hide
          type="number"
          domain={yAxisDomain as AxisDomain}
          allowDecimals={allowDecimals}
        />
        <YAxis yAxisId="events" hide type="number" domain={yAxisDomain as AxisDomain} allowDecimals={allowDecimals} />
      </>
    );
  };

  const _AxisAndCartesianGridSetup = () => {
    _xAxisSetup();
    _yAxisSetup();
    <CartesianGrid
      vertical={false}
      stroke="var(--chakra-colors-gray-emphasized)"
      strokeWidth={0.8}
      strokeDasharray="10 5"
    />;
  };

  // ========================================================= //
  // ======================= Render ========================== //
  // ========================================================= //
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
                      isActive={isMobile || activeCategoryKeys.includes(categoryKey)}
                      onClick={() => toggleCategory(categoryKey)}
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
        {showEvents && _eventCounterDisplay()}

        <AspectRatio
          pos="relative"
          w="100%"
          ratio={{ base: 9 / 3.5, md: 9 / 3 }}
          css={{
            '& .recharts-xAxis .recharts-text, & .recharts-yAxis .recharts-text': { fontSize: 'xs', fill: 'gray.500' },
            '& .recharts-area-area': {
              stroke: 'transparent!important',
            },
          }}
        >
          {data.chartTimeSeries.length == 0 ? (
            <DashboardChartDataMissing />
          ) : (
            <Box pos="absolute" inset={0}>
              <ResponsiveContainer>
                <RechartsComposedChart data={chartData} margin={{ top: showEvents ? 40 : 15 }} maxBarSize={15}>
                  {_AxisAndCartesianGridSetup()}

                  <RechartsTooltip
                    wrapperStyle={{ outline: 'none', zIndex: '10' }}
                    isAnimationActive={true}
                    animationDuration={100}
                    cursor={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    offset={20}
                    position={{ y: 0 }}
                    content={({ active, payload, label }) => {
                      const cleanPayload: Array<ChartPayloadItem> = payload
                        ? payload.map((item: any) => ({
                            categoryKey: item.dataKey,
                            value: item.value,
                            color: CHART_CATEGORY_MAP[item.dataKey as ChartCategoryKey]?.color ?? 'blue',
                            type: item.type,
                            payload: item.payload,
                          }))
                        : [];

                      return active ? (
                        <Box
                          border="1px solid"
                          borderColor="purple.emphasized"
                          rounded="lg"
                          bg="bg"
                          minW="140px"
                          overflow="hidden"
                          boxShadow="sm"
                        >
                          <Box
                            px={3}
                            py={2}
                            borderBottom="1px solid"
                            borderColor="purple.muted"
                            fontWeight="semibold"
                            bg="purple.subtle"
                          >
                            {label} {showEndDate && `- ${payload?.[0]?.payload?.endDate}`}
                          </Box>
                          {cleanPayload.map(({ categoryKey, value }) => {
                            const category = CHART_CATEGORY_MAP[categoryKey as ChartCategoryKey];
                            return (
                              <Flex key={categoryKey} align="center" px={3} py={2} gap={5} justify="space-between">
                                <Flex align="center" gap={2}>
                                  <Icon as={category?.icon} color={category?.color + '.500'} />
                                  <Text textTransform="capitalize" fontWeight="semibold">
                                    {category?.label}
                                  </Text>
                                </Flex>
                                {category?.valueFormatter ? category?.valueFormatter?.(value) : formatNumber(value)}
                              </Flex>
                            );
                          })}
                        </Box>
                      ) : null;
                    }}
                  />

                  {/* Background Area Chart */}
                  {activeCategories.map(([category, { color, yAxisId = 'other' }]) => {
                    const categoryId = `${areaId}-${category.replace(/[^a-zA-Z0-9]/g, '')}`;

                    return (
                      <React.Fragment key={category}>
                        <defs key={category}>
                          <linearGradient
                            key={category}
                            style={{ color: `var(--chakra-colors-${color}-500)` }}
                            id={categoryId}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor="currentColor" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
                          </linearGradient>
                        </defs>

                        <Area
                          style={{ stroke: `var(--chakra-colors-${color}-500)` }}
                          strokeOpacity={1}
                          key={category}
                          name={category}
                          type="linear"
                          yAxisId={yAxisId}
                          dataKey={category}
                          stroke=""
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          isAnimationActive={timespan === 'live'}
                          connectNulls={connectNulls}
                          fill={`url(#${categoryId})`}
                          activeDot={(props: any) => {
                            const {
                              cx: cxCoord,
                              cy: cyCoord,
                              stroke,
                              strokeLinecap,
                              strokeLinejoin,
                              strokeWidth,
                            } = props;
                            return (
                              <Dot
                                style={{ fill: `var(--chakra-colors-${color}-500)` }}
                                cx={cxCoord}
                                cy={cyCoord}
                                r={5}
                                fill=""
                                stroke={stroke}
                                strokeLinecap={strokeLinecap}
                                strokeLinejoin={strokeLinejoin}
                                strokeWidth={strokeWidth}
                              />
                            );
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                  {showEvents && _BarChartVisuals()}
                </RechartsComposedChart>
              </ResponsiveContainer>
            </Box>
          )}
        </AspectRatio>
      </Card.Body>
    </Card.Root>
  );
};
