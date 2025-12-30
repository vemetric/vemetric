import type { StatRootProps } from '@chakra-ui/react';
import { Box, Flex, Icon, Skeleton, Stat, Text } from '@chakra-ui/react';
import { formatNumber } from '@vemetric/common/math';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { TbEye, TbClock, TbDoorExit, TbUserSquareRounded, TbBolt } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import type { ChartCategoryKey } from '@/hooks/use-chart-toggles';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import type { MetricTrend } from '@/utils/trends';
import { getTrendColor, getTrendIcon } from '@/utils/trends';
import { NumberCounter } from '../../number-counter';

export interface ChartCategory {
  label: string;
  icon: IconType;
  color: string;
  yAxisId?: string;
  valueFormatter?: (value: number) => string;
  higherIsBetter?: boolean; // Used to determine trend color (default: true)
}

export const CHART_CATEGORY_MAP: Record<ChartCategoryKey, ChartCategory> = {
  users: { label: 'Users', icon: TbUserSquareRounded, color: 'blue', higherIsBetter: true },
  pageViews: {
    label: 'Page Views',
    icon: TbEye,
    color: 'purple',
    higherIsBetter: true,
  },
  bounceRate: {
    label: 'Bounce Rate',
    icon: TbDoorExit,
    color: 'yellow',
    yAxisId: 'bounceRate',
    valueFormatter: (value: number) => `${value.toFixed(0)}%`,
    higherIsBetter: false, // Lower bounce rate is better
  },
  visitDuration: {
    label: 'Visit Duration',
    icon: TbClock,
    color: 'pink',
    yAxisId: 'visitDuration',
    valueFormatter: (value: number) => dateTimeFormatter.formatDuration(value),
    higherIsBetter: true, // Longer visits are better
  },
  events: {
    label: 'Events',
    icon: TbBolt,
    color: 'orange',
    yAxisId: 'events',
    higherIsBetter: true,
  },
};
export const CHART_CATEGORIES = Object.entries(CHART_CATEGORY_MAP) as [ChartCategoryKey, ChartCategory][];

interface Props extends StatRootProps {
  categoryKey: ChartCategoryKey;
  label?: ReactNode;
  value: number | undefined | null;
  trend?: MetricTrend;
  isActive?: boolean;
  onClick?: () => void;
}

export const ChartCategoryCard = ({ categoryKey, value, label, trend, isActive = false, onClick, ...props }: Props) => {
  const category = CHART_CATEGORY_MAP[categoryKey];
  const TrendIcon = trend ? getTrendIcon(trend.direction) : null;
  const trendColor = trend ? getTrendColor(trend.direction, category.higherIsBetter ?? true) : 'gray.500';

  return (
    <Stat.Root
      p={1.5}
      gap={2}
      rounded="sm"
      transition="all 0.2s ease-in-out"
      outline="1px solid"
      outlineColor={isActive ? 'gray.emphasized' : 'transparent'}
      bg={isActive ? 'gray.subtle' : undefined}
      _hover={onClick ? { opacity: 0.7, bg: 'gray.subtle', outlineColor: 'gray.emphasized' } : undefined}
      onClick={onClick}
      cursor={onClick ? 'pointer' : undefined}
      className="group"
      {...props}
    >
      <Stat.Label gap={1.5}>
        <CardIcon size="xs">
          <category.icon />
        </CardIcon>
        <Flex gap={3.5}>
          {category.label}
          {label}
        </Flex>
        <Box flexGrow={1} />
        <Box
          w="13px"
          h="2.5px"
          bg={`${category.color}.500`}
          rounded="lg"
          mr="2px"
          transition="opacity 0.2s ease-in-out"
          opacity={isActive ? 1 : 0}
          _groupHover={{ opacity: 1 }}
        />
      </Stat.Label>
      <Flex gap={2} align="flex-end" justify="space-between">
        <Stat.ValueText>
          {typeof value === 'number' ? (
            category.valueFormatter ? (
              category.valueFormatter(value)
            ) : (
              <NumberCounter value={value} fontSize="3xl" />
            )
          ) : (
            '-'
          )}
        </Stat.ValueText>
        {trend ? (
          <Flex align="center" gap={0.5} color={trendColor}>
            {TrendIcon && <Icon as={TrendIcon} boxSize={3.5} />}
            <Text fontSize="xs" fontWeight="medium">
              {formatNumber(trend.percentage)}%
            </Text>
          </Flex>
        ) : (
          <Skeleton w="40px" h="4" />
        )}
      </Flex>
    </Stat.Root>
  );
};
