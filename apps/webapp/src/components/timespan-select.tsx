import { Button, Flex } from '@chakra-ui/react';
import { getRouteApi, Navigate, useParams, useRouter } from '@tanstack/react-router';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { isTimespanAllowed, TIME_SPAN_DATA } from '@vemetric/common/charts/timespans';
import { TbClock } from 'react-icons/tb';
import { MenuContent, MenuRadioItem, MenuRadioItemGroup, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import type { TimespanRoute } from '@/hooks/use-timespan-param';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { trpc } from '@/utils/trpc';
import { Status } from './ui/status';
import { Tooltip } from './ui/tooltip';

interface Props {
  from: TimespanRoute;
  excludeLive?: boolean;
}

export const TimespanSelect = ({ from, excludeLive = false }: Props) => {
  const router = useRouter();
  const route = getRouteApi(from);

  const { projectId, domain } = useParams({ strict: false });
  const navigate = route.useNavigate();
  const { timespan } = useTimespanParam({ from });

  const { data, isLoading } = trpc.billing.subscriptionActive.useQuery({ domain, projectId });

  if (excludeLive && timespan === 'live') {
    return <Navigate from={router.routesById[route.id].fullPath} search={{ t: '24hrs' }} replace />;
  }

  if (!isLoading && !isTimespanAllowed(timespan, Boolean(data?.isSubscriptionActive))) {
    return <Navigate from={router.routesById[route.id].fullPath} search={{ t: '30days' }} replace />;
  }

  const timeSpanData = TIME_SPAN_DATA[timespan];

  return (
    <MenuRoot positioning={{ placement: 'bottom-end' }}>
      <MenuTrigger asChild>
        <Button variant="surface" size={{ base: 'xs', md: 'sm' }}>
          {timespan === 'live' ? <Status value="success" color="fg" gap={1.5} /> : <TbClock />} {timeSpanData.label}
        </Button>
      </MenuTrigger>
      <MenuContent minW="10rem">
        <MenuRadioItemGroup
          value={timespan}
          onValueChange={({ value }) => {
            navigate({
              resetScroll: false,
              search: (prev) => ({ ...prev, t: String(value) as TimeSpan }),
            });
          }}
        >
          {Object.entries(TIME_SPAN_DATA)
            .filter(([key]) => !excludeLive || key !== 'live')
            .map(([key, value]) => {
              const isDisabled = !isTimespanAllowed(key as TimeSpan, Boolean(data?.isSubscriptionActive));

              return (
                <Tooltip
                  key={key}
                  contentProps={{ maxW: '230px' }}
                  content="Upgrade to the Professional plan for longer data retention."
                  disabled={!isDisabled}
                >
                  <MenuRadioItem value={key} disabled={isDisabled}>
                    <Flex alignItems="center" gap={2}>
                      {value.label}
                      {key === 'live' ? <Status value="success" color="fg" gap={1.5} /> : null}
                    </Flex>
                  </MenuRadioItem>
                </Tooltip>
              );
            })}
        </MenuRadioItemGroup>
      </MenuContent>
    </MenuRoot>
  );
};
