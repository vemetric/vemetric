import { Box, Flex, FormatNumber, HStack, Progress, SimpleGrid, Span, Text, Badge } from '@chakra-ui/react';
import { Fragment } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { getFaviconUrl } from '@/utils/favicon';
import type { UsageCycle } from '@/utils/pricing';
import { formatTimeSpanDateRange } from '@/utils/timespans';
import { LoadingImage } from './loading-image';

interface UsageCycleItemProps {
  cycle: UsageCycle;
  eventsIncluded: number;
}

const UsageCycleItem = ({ cycle, eventsIncluded }: UsageCycleItemProps) => {
  const { usage, type, exceeded } = cycle;
  const eventsUsed = usage.total;

  const dateRange = formatTimeSpanDateRange(usage.periodStart, usage.periodEnd);
  const periodLabel = type === 'current' ? 'Current Cycle' : type === 'previous' ? 'Previous Cycle' : 'Past Cycle';

  return (
    <Tooltip
      disabled={usage.perProject.length === 0}
      content={
        <SimpleGrid columns={2} py={1.5} gap={3}>
          {usage.perProject.map(({ name, domain, events }) => (
            <Fragment key={domain}>
              <Flex align="center" gap={1.5}>
                <LoadingImage src={getFaviconUrl(domain)} alt={name} boxSize="18px" rounded="xs" overflow="hidden" />
                <Text>{name}</Text>
              </Flex>
              <Text textAlign="right">
                <FormatNumber value={events} />
              </Text>
            </Fragment>
          ))}
        </SimpleGrid>
      }
    >
      <Box w="full">
        <Progress.Root
          w="full"
          size="xs"
          min={0}
          max={eventsIncluded}
          value={Math.min(eventsUsed, eventsIncluded)}
          colorPalette={exceeded ? 'red' : 'purple'}
        >
          <HStack mb="2" alignItems="center">
            <Flex flex="1" align="center" gap={2}>
              <Progress.Label gap="0">
                <Text as="span" hideBelow="md">
                  {periodLabel} (
                </Text>
                <Text fontStyle="italic">{dateRange}</Text>
                <Text as="span" hideBelow="md">
                  )
                </Text>
              </Progress.Label>
              {exceeded && (
                <Badge size="xs" colorPalette="red" variant="solid" hideBelow="md">
                  Exceeded
                </Badge>
              )}
            </Flex>
            <HStack color="fg.muted" gap="1">
              <Span color={exceeded ? 'fg.error' : 'fg'}>
                <FormatNumber value={eventsUsed} />
              </Span>
              <Span>/</Span>
              <FormatNumber value={eventsIncluded} />
            </HStack>
          </HStack>
          <Progress.Track rounded="md">
            <Progress.Range />
          </Progress.Track>
        </Progress.Root>
      </Box>
    </Tooltip>
  );
};

interface Props {
  cycles: UsageCycle[];
  eventsIncluded: number;
}

export const UsageCycleHistory = ({ cycles, eventsIncluded }: Props) => {
  return (
    <Flex direction="column" gap={4} w="full">
      {cycles.map((cycle) => (
        <UsageCycleItem key={cycle.usage.periodStart} cycle={cycle} eventsIncluded={eventsIncluded} />
      ))}
    </Flex>
  );
};
