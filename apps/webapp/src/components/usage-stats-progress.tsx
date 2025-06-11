import { Box, Span, Text, HStack, Progress, FormatNumber, Flex, SimpleGrid, Image } from '@chakra-ui/react';
import type { UsageStats } from '@vemetric/common/usage';
import { Fragment } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { getFaviconUrl } from '@/utils/favicon';

interface Props {
  usageStats?: UsageStats;
  eventsIncluded: number;
}

export const UsageStatsProgress = ({ usageStats, eventsIncluded }: Props) => {
  const eventsUsed = usageStats?.total ?? 0;
  const eventUsageExceeded = eventsUsed > eventsIncluded;

  return (
    <Tooltip
      disabled={!usageStats || usageStats.perProject.length === 0}
      content={
        <SimpleGrid columns={2} py={1.5} gap={3}>
          {usageStats?.perProject.map(({ name, domain, events }) => (
            <Fragment key={domain}>
              <Flex align="center" gap={1.5}>
                <Image
                  src={getFaviconUrl('https://' + domain)}
                  alt={name}
                  boxSize="18px"
                  flexShrink={0}
                  rounded="xs"
                  overflow="hidden"
                />
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
          colorPalette={eventUsageExceeded ? 'red' : 'purple'}
        >
          <HStack mb="3" alignItems="center">
            <Progress.Label flex="1">Pageviews + Custom Events</Progress.Label>
            <HStack color="fg.muted" gap="1">
              <Span color="fg">
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
