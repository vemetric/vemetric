import { Center, Box, SimpleGrid, Card, AspectRatio, Flex, Text } from '@chakra-ui/react';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { formatNumber } from '@vemetric/common/math';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { ChartCategoryKey } from '@/hooks/use-chart-toggles';
import { AUTH_ILLUSTRATION_DATA, AUTH_ILLUSTRATION_TRENDS } from './auth-illustration-data';
import { PageDotBackground } from '../../page-dot-background';
import { Status } from '../../ui/status';
import { Tooltip } from '../../ui/tooltip';
import type { ChartCategory } from '../dashboard/chart-category-card';
import { CHART_CATEGORIES, ChartCategoryCard } from '../dashboard/chart-category-card';
import { DashboardCardHeader } from '../dashboard/dashboard-card-header';
import { getTimespanInterval, transformChartSeries } from '../dashboard/dashboard-chart';
import { TimeSeriesChart } from '../dashboard/time-series-chart';

const timespan: TimeSpan = '30days';
const chartData = transformChartSeries(
  AUTH_ILLUSTRATION_DATA.chartTimeSeries ?? [],
  getTimespanInterval(timespan),
  timespan,
);
const CHART_REVEAL = { duration: 2000, delay: 500, easing: 'ease-in-out' };

export const AuthIllustration = () => {
  const [startAnimation, setStartAnimation] = useState(false);
  const [animateChartHeight, setAnimateChartHeight] = useState(false);
  const [animateChart, setAnimateChart] = useState(false);
  const [animateTransform, setAnimateTransform] = useState(false);
  const [activeCategoryKeys, setActiveCategoryKeys] = useState<Array<ChartCategoryKey>>(['users', 'pageViews']);
  const activeCategories = useMemo(
    () =>
      CHART_CATEGORIES.filter(
        (entry): entry is [Exclude<ChartCategoryKey, 'events'>, ChartCategory] =>
          entry[0] !== 'events' && activeCategoryKeys.includes(entry[0]),
      ),
    [activeCategoryKeys],
  );
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
                            trend={AUTH_ILLUSTRATION_TRENDS?.[categoryKey]}
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
                    >
                      <Box pos="absolute" inset={0}>
                        {animateChart && (
                          <TimeSeriesChart
                            data={chartData}
                            categories={activeCategories}
                            showEvents={false}
                            showEndDate={false}
                            reveal={CHART_REVEAL}
                            hideYAxis={false}
                          />
                        )}
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
