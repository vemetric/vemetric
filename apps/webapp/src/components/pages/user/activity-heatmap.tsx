import { Box, Flex, Text, Grid, useBreakpointValue, Skeleton } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
  userId: string;
  selectedDate?: string;
}

export function ActivityHeatmap({ projectId, userId, selectedDate }: Props) {
  // Show more months on larger screens
  const monthsToShow = useBreakpointValue({ base: 6, md: 4, lg: 6 }) ?? 6;

  const { data, isLoading } = trpc.users.activityHeatmap.useQuery({ projectId, userId });
  const eventMap = data?.eventMap;
  const startDate = data?.startDate ? new Date(data.startDate) : undefined;

  const navigate = useNavigate({ from: '/p/$projectId/users/$userId' });
  const toggleDate = (date: string) => {
    navigate({ resetScroll: false, search: (prev) => ({ ...prev, date: prev.date === date ? undefined : date }) });
  };

  const { months, daysByMonth } = useMemo(() => {
    const now = new Date();

    const months: string[] = [];
    const daysByMonth: Record<
      string,
      Array<{
        date: Date;
        count: number;
      }>
    > = {};

    // Generate months array and initialize daysByMonth
    for (let i = 0; i < monthsToShow; i++) {
      const date = new Date(now);
      date.setMonth(now.getMonth() - i);
      const monthKey = dateTimeFormatter.formatMonth(date);
      months.unshift(monthKey);
      daysByMonth[monthKey] = [];
    }

    // Generate days array and group by month
    for (let i = 0; i < monthsToShow * 31; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const monthKey = dateTimeFormatter.formatMonth(date);

      if (!daysByMonth[monthKey]) {
        continue; // Skip if month is not in our display range
      }

      const key = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      daysByMonth[monthKey].unshift({
        date,
        count: eventMap?.[key] ?? 0,
      });
    }

    // Pad each month's days array to be divisible by 7 (for grid layout)
    Object.keys(daysByMonth).forEach((month) => {
      const daysInMonth = daysByMonth[month].length;
      const padding = 35 - daysInMonth; // 7 columns × 5 rows = 35 cells
      for (let i = 0; i < padding; i++) {
        daysByMonth[month].push({ date: new Date(0), count: -1 }); // Use count -1 to indicate padding
      }
    });

    return { months, daysByMonth };
  }, [eventMap, monthsToShow]);

  const maxCount = Math.max(
    ...Object.values(daysByMonth).flatMap((days) => days.map((day) => day.count).filter((count) => count >= 0)),
  );

  return (
    <Box>
      <Box overflowX="hidden" pb={2} direction="rtl" pos="relative" p={2} m={-2}>
        <Box minW="fit-content" direction="ltr">
          <Grid templateColumns={`repeat(${months.length}, 1fr)`} gap={3}>
            {months.map((month) => {
              const dayCount = daysByMonth[month].filter((day) => day.count !== -1).length;

              return (
                <Flex key={month} flexDirection="column" gap={2}>
                  <Text key={month} fontSize="sm" color="gray.500">
                    {month}
                  </Text>
                  <Grid templateColumns={`repeat(${Math.min(dayCount, 7)}, 12px)`} gap="4px">
                    {daysByMonth[month].map((day, index) => {
                      if (day.count === -1) {
                        return null;
                      }

                      const intensity = day.count === 0 ? 0 : Math.max(0.3, Math.min(1, day.count / maxCount));
                      const color = `purple.500/${(intensity * 0.85 + 0.15) * 100}`; // Purple color with varying opacity
                      const hasSelection = selectedDate !== undefined;
                      const dateString = day.date.toISOString().split('T')[0];
                      const isSelected = dateString === selectedDate;

                      const isOutOfDataRetention = startDate && day.date < startDate;
                      let tooltipContent = `${dateTimeFormatter.formatDate(day.date)}: ${day.count} events`;
                      if (isOutOfDataRetention) {
                        tooltipContent = 'Upgrade to the Professional plan for longer data retention';
                      }

                      let opacity = 1;
                      if (hasSelection && !isSelected) {
                        opacity = 0.3;
                      } else if (isOutOfDataRetention) {
                        opacity = 0.3;
                      }

                      return (
                        <Box key={index} transition="all 0.2s" opacity={opacity}>
                          <Tooltip content={tooltipContent}>
                            {isLoading ? (
                              <Skeleton w="12px" h="12px" bg="purple.500/25" rounded="xs" />
                            ) : (
                              <Box
                                w="12px"
                                h="12px"
                                bg={color}
                                rounded="xs"
                                cursor="pointer"
                                _hover={{ transform: 'scale(1.2)' }}
                                transition="all 0.2s"
                                border={isSelected ? '1px solid' : undefined}
                                borderColor={isSelected ? 'purple.500' : undefined}
                                onClick={() => toggleDate(dateString)}
                              />
                            )}
                          </Tooltip>
                        </Box>
                      );
                    })}
                  </Grid>
                </Flex>
              );
            })}
          </Grid>
        </Box>
        <Box
          pos="absolute"
          pointerEvents="none"
          left={0}
          top={0}
          bottom={0}
          w="40px"
          bg="linear-gradient(to right, var(--chakra-colors-bg-card) 10%, rgba(255, 255, 255, 0))"
        />
      </Box>
    </Box>
  );
}
