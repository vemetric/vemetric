import { Center, Box, SimpleGrid, Card, AspectRatio, Flex, Icon, Text } from '@chakra-ui/react';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { formatNumber } from '@vemetric/common/math';
import { AnimatePresence, motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import {
  Area,
  Dot,
  ComposedChart as RechartsComposedChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { AxisDomain } from 'recharts/types/util/types';
import { AUTH_ILLUSTRATION_DATA } from './auth-illustration-data';
import { PageDotBackground } from '../../page-dot-background';
import { Status } from '../../ui/status';
import { Tooltip } from '../../ui/tooltip';
import type { ChartCategoryKey } from '../dashboard/chart-category-card';
import { CHART_CATEGORIES, CHART_CATEGORY_MAP, ChartCategoryCard } from '../dashboard/chart-category-card';
import { DashboardCardHeader } from '../dashboard/dashboard-card-header';
import type { ChartPayloadItem } from '../dashboard/dashboard-chart';
import { getTimespanInterval, getYAxisDomain, transformChartSeries } from '../dashboard/dashboard-chart';

export const AuthIllustration = () => {
  const areaId = React.useId();
  const yAxisDomain = getYAxisDomain(false);
  const connectNulls = false;

  const [startAnimation, setStartAnimation] = useState(false);
  const [animateChartHeight, setAnimateChartHeight] = useState(false);
  const [animateChart, setAnimateChart] = useState(false);
  const [animateTransform, setAnimateTransform] = useState(false);
  const [activeCategoryKeys, setActiveCategoryKeys] = useState<Array<ChartCategoryKey>>(['users', 'pageViews']);
  const activeCategories = CHART_CATEGORIES.filter(([key]) => activeCategoryKeys.includes(key as ChartCategoryKey));

  const timespan: TimeSpan = '30days';
  const timeSpanInterval = getTimespanInterval(timespan);
  const chartData = transformChartSeries(AUTH_ILLUSTRATION_DATA.chartTimeSeries ?? [], timeSpanInterval, timespan);
  const onlineUsers = formatNumber(AUTH_ILLUSTRATION_DATA?.currentActiveUsers ?? 0, true);

  const toggleCategory = (category: ChartCategoryKey) => {
    setActiveCategoryKeys((prev) => {
      if (!animateTransform || (prev.length === 1 && prev[0] === category)) {
        return prev;
      }

      return prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category];
    });
  };

  useEffect(() => {
    const initialDelay = 300;
    const timeout1 = setTimeout(() => setStartAnimation(true), initialDelay);
    const timeout2 = setTimeout(() => setAnimateChartHeight(true), 1400 + initialDelay);
    const timeout3 = setTimeout(() => setAnimateChart(true), 1700 + initialDelay);
    const timeout4 = setTimeout(() => setAnimateTransform(true), 2000 + initialDelay);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      clearTimeout(timeout4);
    };
  }, []);

  return (
    <Box w="full" h="full" pos="relative" bg="linear-gradient(to top, #602fc4ff, #7157d1ff)" overflow="hidden" p={5}>
      <PageDotBackground dotColor="#9696be" />
      <Center
        pos="relative"
        h="full"
        w="full"
        flexDir="column"
        transform={
          animateTransform
            ? 'translate3d(0px, 0px, 100vmin) scale(1) rotateX(calc(var(--x1, -13) * 1deg)) rotateY(calc(var(--y1, 22) * 1deg)) rotateX(calc(var(--x2, 36) * 1deg))'
            : undefined
        }
        transition="all 1s ease-in-out"
      >
        <Box pos="relative">
          <Box
            pos="absolute"
            inset="0"
            bg={{ base: 'whiteAlpha.300', _dark: 'blackAlpha.300' }}
            rounded="lg"
            opacity={animateTransform ? 1 : 0}
          />
          <Box
            pos="relative"
            transition="transform 0.7s ease-in-out"
            transitionDelay="0.9s"
            transform={animateTransform ? 'translate(10px, -10px)' : 'translate(0, 0)'}
          >
            <Card.Root
              rounded="lg"
              flex="1"
              maxW="800px"
              display="block"
              bg={startAnimation ? undefined : 'transparent'}
              borderColor={startAnimation ? undefined : 'transparent'}
              transition="all 1s ease-in-out"
              transitionDelay="0.8s"
            >
              <DashboardCardHeader
                p={1.5}
                pb={1.5}
                borderColor={animateChartHeight ? 'gray.emphasized/50' : 'transparent'}
                transition="border-color 1s ease-in-out"
              >
                <SimpleGrid columns={4} flex="1" gap={2}>
                  <AnimatePresence>
                    {CHART_CATEGORIES.filter(([key]) => key !== 'events').map(([_categoryKey], index) => {
                      const categoryKey = _categoryKey as Exclude<ChartCategoryKey, 'events'>;
                      if (!startAnimation) {
                        return false;
                      }

                      const INITIAL_DELAY = 0.3;
                      return (
                        <motion.div
                          key={categoryKey}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            transition: { duration: 1, delay: INITIAL_DELAY + index * 0.3, bounce: 0 },
                          }}
                        >
                          <ChartCategoryCard
                            categoryKey={categoryKey}
                            value={AUTH_ILLUSTRATION_DATA?.[categoryKey]}
                            isActive={activeCategoryKeys.includes(categoryKey)}
                            onClick={() => toggleCategory(categoryKey)}
                            label={
                              categoryKey === 'users' ? (
                                <Tooltip content={`${onlineUsers} users are currently online`}>
                                  <Status value="success" color="fg" gap={1.5}>
                                    <Text fontWeight="semibold">{onlineUsers}</Text>
                                  </Status>
                                </Tooltip>
                              ) : undefined
                            }
                            whiteSpace="nowrap"
                          />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </SimpleGrid>
              </DashboardCardHeader>
              <Card.Body asChild p="0" pos="relative" overflow="hidden">
                <motion.div
                  layout
                  initial={{ height: 0 }}
                  animate={{
                    height: animateChartHeight ? 'auto' : 0,
                    transition: { duration: 1.5, bounce: 0 },
                  }}
                >
                  <Box p="2.5">
                    <AspectRatio
                      pos="relative"
                      w="100%"
                      ratio={{ base: 9 / 3.5, md: 9 / 3 }}
                      opacity={animateChart ? 1 : 0}
                      transition="opacity 1s ease-in-out"
                      css={{
                        '& .recharts-xAxis .recharts-text, & .recharts-yAxis .recharts-text': {
                          fontSize: 'xs',
                          fill: 'gray.500',
                        },
                        '& .recharts-area-area': {
                          stroke: 'transparent!important',
                        },
                      }}
                    >
                      <Box pos="absolute" inset={0}>
                        <ResponsiveContainer>
                          <RechartsComposedChart data={chartData} margin={{ top: 15 }} maxBarSize={15}>
                            <XAxis
                              dataKey="startDate"
                              interval="preserveStartEnd"
                              tick={{ transform: 'translate(0, 6)' }}
                              fill=""
                              stroke=""
                              tickLine={false}
                              axisLine={true}
                              minTickGap={15}
                              scale="point"
                            />
                            <YAxis
                              yAxisId="other"
                              type="number"
                              domain={yAxisDomain as AxisDomain}
                              allowDecimals
                              axisLine={false}
                              tickLine={false}
                              width={40}
                              tickFormatter={(value) => formatNumber(value, true)}
                            />
                            <YAxis
                              yAxisId="bounceRate"
                              hide
                              type="number"
                              domain={yAxisDomain as AxisDomain}
                              allowDecimals
                            />
                            <YAxis
                              yAxisId="visitDuration"
                              hide
                              type="number"
                              domain={yAxisDomain as AxisDomain}
                              allowDecimals
                            />
                            <YAxis
                              yAxisId="events"
                              hide
                              type="number"
                              domain={yAxisDomain as AxisDomain}
                              allowDecimals
                            />
                            <CartesianGrid
                              vertical={false}
                              stroke="var(--chakra-colors-gray-emphasized)"
                              strokeWidth={0.8}
                              strokeDasharray="10 5"
                            />

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
                                      {label}
                                    </Box>
                                    {cleanPayload.map(({ categoryKey, value }) => {
                                      const category = CHART_CATEGORY_MAP[categoryKey as ChartCategoryKey];
                                      return (
                                        <Flex
                                          key={categoryKey}
                                          align="center"
                                          px={3}
                                          py={2}
                                          gap={5}
                                          justify="space-between"
                                        >
                                          <Flex align="center" gap={2}>
                                            <Icon as={category?.icon} color={category?.color + '.500'} />
                                            <Text textTransform="capitalize" fontWeight="semibold">
                                              {category?.label}
                                            </Text>
                                          </Flex>
                                          {category?.valueFormatter
                                            ? category?.valueFormatter?.(value)
                                            : formatNumber(value)}
                                        </Flex>
                                      );
                                    })}
                                  </Box>
                                ) : null;
                              }}
                            />

                            {animateChart &&
                              activeCategories.map(([category, { color, yAxisId = 'other' }]) => {
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
                                      key={category}
                                      name={category}
                                      type="linear"
                                      yAxisId={yAxisId}
                                      dataKey={category}
                                      stroke=""
                                      strokeWidth={2}
                                      strokeLinejoin="round"
                                      strokeLinecap="round"
                                      isAnimationActive={true}
                                      animationDuration={2000}
                                      animationEasing="ease-in-out"
                                      connectNulls={connectNulls}
                                      fill={`url(#${categoryId})`}
                                    />
                                  </React.Fragment>
                                );
                              })}
                          </RechartsComposedChart>
                        </ResponsiveContainer>
                      </Box>
                    </AspectRatio>
                  </Box>
                </motion.div>
              </Card.Body>
            </Card.Root>
          </Box>
        </Box>
        <Flex justifyContent="center" pos="relative" w="full">
          <Box color={{ base: 'white', _dark: 'gray.200' }} pos="absolute" w="max-content" mt={8}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.6, delay: 3.7 } }}
            >
              <Text fontWeight="bold" fontSize="4xl" lineHeight="1.4em" maxW="430px" textAlign="center" mb={3}>
                Simple, yet actionable Web & Product Analytics
              </Text>
            </motion.div>
          </Box>
        </Flex>
      </Center>
    </Box>
  );
};
