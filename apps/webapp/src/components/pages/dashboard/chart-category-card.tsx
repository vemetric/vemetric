import type { StatRootProps } from '@chakra-ui/react';
import { Box, Flex, Stat } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { TbEye, TbClock, TbDoorExit, TbUserSquareRounded, TbBolt } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { NumberCounter } from '../../number-counter';

export const CHART_CATEGORY_KEYS = ['users', 'pageViews', 'bounceRate', 'visitDuration', 'events'] as const;
export type ChartCategoryKey = (typeof CHART_CATEGORY_KEYS)[number];
export interface ChartCategory {
  label: string;
  icon: IconType;
  color: string;
  yAxisId?: string;
  valueFormatter?: (value: number) => string;
}

export const CHART_CATEGORY_MAP: Record<ChartCategoryKey, ChartCategory> = {
  users: { label: 'Users', icon: TbUserSquareRounded, color: 'blue' },
  pageViews: {
    label: 'Page Views',
    icon: TbEye,
    color: 'purple',
  },
  bounceRate: {
    label: 'Bounce Rate',
    icon: TbDoorExit,
    color: 'yellow',
    yAxisId: 'bounceRate',
    valueFormatter: (value: number) => `${value.toFixed(0)}%`,
  },
  visitDuration: {
    label: 'Visit Duration',
    icon: TbClock,
    color: 'pink',
    yAxisId: 'visitDuration',
    valueFormatter: (value: number) => dateTimeFormatter.formatDuration(value),
  },
  events: {
    label: 'Events',
    icon: TbBolt,
    color: 'orange',
    yAxisId: 'events',
  },
};
export const CHART_CATEGORIES = Object.entries(CHART_CATEGORY_MAP) as [ChartCategoryKey, ChartCategory][];

interface Props extends StatRootProps {
  categoryKey: ChartCategoryKey;
  label?: ReactNode;
  value: number | undefined | null;
  isActive?: boolean;
  onClick?: () => void;
}

export const ChartCategoryCard = ({ categoryKey, value, label, isActive = false, onClick, ...props }: Props) => {
  const category = CHART_CATEGORY_MAP[categoryKey];

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
      <Flex gap={2} align="center">
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
      </Flex>
    </Stat.Root>
  );
};
