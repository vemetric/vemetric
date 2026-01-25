import { Box, Card, Flex, Text, Progress, LinkOverlay, Skeleton, Badge, Button } from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { TbChartFunnel } from 'react-icons/tb';
import { CardIcon } from '~/components/card-icon';
import { CustomIconStyle } from '~/components/custom-icon-style';
import { EmptyState } from '~/components/ui/empty-state';
import { trpc } from '~/utils/trpc';

interface UserFunnelProgressProps {
  projectId: string;
  userId: string;
}

export function UserFunnelProgress({ projectId, userId }: UserFunnelProgressProps) {
  const { data, isLoading } = trpc.users.funnelProgress.useQuery({ projectId, userId });
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <Card.Root rounded="xl">
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbChartFunnel />
            </CardIcon>
            <Text fontWeight="semibold">Funnel Progress</Text>
          </Flex>
        </Card.Header>
        <Card.Body p={4} pb={3}>
          <Flex flexDir="column" gap={3}>
            <Skeleton h="60px" w="100%" rounded="md" />
            <Skeleton h="60px" w="100%" rounded="md" />
            <Skeleton h="60px" w="100%" rounded="md" />
          </Flex>
        </Card.Body>
      </Card.Root>
    );
  }

  const funnelsData = data?.funnelsData ?? [];
  const hasFunnels = (funnelsData.length ?? 0) > 0;
  const displayFunnels = showAll ? funnelsData : funnelsData.filter((funnel) => funnel.completedStep > 0);

  if (!hasFunnels) {
    return (
      <Card.Root rounded="xl">
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbChartFunnel />
            </CardIcon>
            <Text fontWeight="semibold">Funnel Progress</Text>
          </Flex>
        </Card.Header>
        <Card.Body>
          <EmptyState
            icon={<TbChartFunnel />}
            title="No funnels available"
            description="Create your first funnel to start tracking conversions."
          >
            <Button asChild size="sm">
              <Link to="/p/$projectId/funnels" params={{ projectId }}>
                Create Funnel
              </Link>
            </Button>
          </EmptyState>
        </Card.Body>
      </Card.Root>
    );
  }

  return (
    <Card.Root rounded="xl">
      <Card.Header>
        <Flex align="center" justify="space-between">
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbChartFunnel />
            </CardIcon>
            <Text fontWeight="semibold">Funnel Progress</Text>
          </Flex>
          <Button
            size="xs"
            variant="surface"
            colorPalette={showAll ? 'purple' : 'gray'}
            onClick={() => setShowAll(!showAll)}
          >
            <TbChartFunnel /> All
          </Button>
        </Flex>
      </Card.Header>
      <Card.Body p={4} pb={3}>
        {displayFunnels.length === 0 ? (
          <EmptyState
            icon={<TbChartFunnel />}
            title="No funnels started"
            description="This user hasn't started any funnels yet."
          />
        ) : (
          <Flex flexDir="column" gap={3}>
            {displayFunnels.map((funnel) => {
              const progressPercentage = (funnel.completedStep / funnel.totalSteps) * 100;
              const isCompleted = funnel.completedStep === funnel.totalSteps;
              const hasStarted = funnel.completedStep > 0;

              return (
                <Card.Root key={funnel.funnelId} variant="outline" size="sm" rounded="md" _hover={{ bg: 'bg.muted' }}>
                  <Card.Body p={3} overflow="hidden">
                    <Box minW={0} flex="1">
                      <Flex align="center" justify="space-between" gap={2} mb={2}>
                        <Flex gap="1.5">
                          {funnel.funnelIcon && <CustomIconStyle>{funnel.funnelIcon}</CustomIconStyle>}
                          <LinkOverlay asChild>
                            <Link
                              to="/p/$projectId/funnels/$funnelId"
                              params={{ projectId, funnelId: funnel.funnelId }}
                            >
                              <Text fontWeight="medium" flexShrink={1} truncate>
                                {funnel.funnelName}
                              </Text>
                            </Link>
                          </LinkOverlay>
                        </Flex>
                        {hasStarted ? (
                          <Text textStyle="sm" fontWeight="medium" color={isCompleted ? 'green.fg' : 'purple.fg'}>
                            {Math.round(progressPercentage)}%
                          </Text>
                        ) : (
                          <Badge colorPalette="gray" size="sm">
                            Not started
                          </Badge>
                        )}
                      </Flex>
                      <Text textStyle="sm" opacity={0.7} mb={2}>
                        {hasStarted
                          ? `Step ${funnel.completedStep} of ${funnel.totalSteps}`
                          : `${funnel.totalSteps} steps`}
                      </Text>
                      <Progress.Root
                        value={progressPercentage}
                        size="sm"
                        colorPalette={isCompleted ? 'green' : hasStarted ? 'purple' : 'gray'}
                        striped={!isCompleted}
                      >
                        <Progress.Track rounded="md">
                          <Progress.Range />
                        </Progress.Track>
                      </Progress.Root>
                    </Box>
                  </Card.Body>
                </Card.Root>
              );
            })}
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  );
}
