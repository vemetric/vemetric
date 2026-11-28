import { Box, HStack } from '@chakra-ui/react';
import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { getActivityColor, getActivityDateKey, getActivityTooltip } from './activity-heatmap';

const DAYS_TO_SHOW = 7;

interface Props {
  eventMap?: Record<string, number>;
  /** Whether the counts only include events matching the current event sort */
  isMatchingEvents?: boolean;
}

export function UserRecentActivity({ eventMap, isMatchingEvents }: Props) {
  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (DAYS_TO_SHOW - 1 - i));
      return { date, count: eventMap?.[getActivityDateKey(date)] ?? 0 };
    });
  }, [eventMap]);

  const maxCount = Math.max(...days.map((day) => day.count));

  return (
    <HStack gap="3px" pos="relative" zIndex="5">
      {days.map((day, index) => {
        return (
          <Tooltip
            key={index}
            content={getActivityTooltip(day.date, day.count, isMatchingEvents ? 'matching event' : undefined)}
          >
            <Box
              w="8px"
              h="8px"
              bg={getActivityColor(day.count, maxCount)}
              rounded="2px"
              _hover={{ transform: 'scale(1.25)' }}
              transition="all 0.2s"
            />
          </Tooltip>
        );
      })}
    </HStack>
  );
}
