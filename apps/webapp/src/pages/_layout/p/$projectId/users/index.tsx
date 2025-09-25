import { Box, Grid, Card, Skeleton, HStack, LinkOverlay, Flex, Icon, Text, IconButton, Span } from '@chakra-ui/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { COUNTRIES } from '@vemetric/common/countries';
import { filterConfigSchema } from '@vemetric/common/filters';
import { userSortConfigSchema } from '@vemetric/common/sort';
import { TbClock, TbChevronRight, TbChevronLeft, TbClockOff } from 'react-icons/tb';
import { z } from 'zod';
import { CountryFlag } from '@/components/country-flag';
import { AddFilterButton } from '@/components/filter/add-filter/add-filter-button';
import { FilterContainer } from '@/components/filter/filter-container';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { FilterSkeletons } from '@/components/filter/filter-skeletons';
import { UserAvatar } from '@/components/pages/user/user-avatar';
import { UserSortPopover } from '@/components/pages/user/user-sort-popover';
import { ProjectInitCard } from '@/components/project-init-card';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import { useSetBreadcrumbs, useSetDocsLink } from '@/stores/header-store';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { trpc } from '@/utils/trpc';
import { getUserName } from '@/utils/user';

const usersSearchSchema = z.object({
  p: z.number().min(1).optional().catch(1),
  f: filterConfigSchema,
  s: userSortConfigSchema,
});

export const Route = createFileRoute('/_layout/p/$projectId/users/')({
  validateSearch: zodValidator(usersSearchSchema),
  component: Page,
});

function Page() {
  const { projectId } = Route.useParams();
  const { p: page = 1, f: filterConfig, s: sortConfig } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: filterableData, isLoading: isFilterableDataLoading } = trpc.filters.getFilterableData.useQuery({
    projectId,
    timespan: '30days',
  });

  const { data, isLoading, isFetching, isPreviousData } = trpc.users.list.useQuery(
    {
      projectId,
      page,
      filterConfig,
      sortConfig,
    },
    { keepPreviousData: true },
  );

  const users = data?.users ?? [];
  const hasNextPage = data?.hasNextPage ?? false;
  const isInitialized = data?.isInitialized ?? false;

  const handlePrevPage = () => {
    const newPage = Math.max(1, page - 1);
    navigate({ search: (prev) => ({ ...prev, p: newPage === 1 ? undefined : newPage }) });
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      navigate({ search: (prev) => ({ ...prev, p: page + 1 }) });
    }
  };

  useSetBreadcrumbs(['Users']);
  useSetDocsLink(
    !isLoading && !isInitialized
      ? 'https://vemetric.com/docs/installation'
      : 'https://vemetric.com/docs/product-analytics/user-journeys',
  );

  const gridTemplateColumns = { base: '50vw 1fr 2fr', md: '30px 3fr 1fr 1fr 40px' };

  return (
    <FilterContextProvider
      value={{
        pagePaths: filterableData?.pagePaths ?? [],
        origins: filterableData?.origins ?? [],
        eventNames: filterableData?.eventNames ?? [],
        countryCodes: filterableData?.countryCodes ?? [],
        referrers: filterableData?.referrers ?? [],
        referrerUrls: filterableData?.referrerUrls ?? [],
        utmCampaigns: filterableData?.utmCampaigns ?? [],
        utmContents: filterableData?.utmContents ?? [],
        utmMediums: filterableData?.utmMediums ?? [],
        utmSources: filterableData?.utmSources ?? [],
        utmTerms: filterableData?.utmTerms ?? [],
        browserNames: filterableData?.browserNames ?? [],
        deviceTypes: filterableData?.deviceTypes ?? [],
        osNames: filterableData?.osNames ?? [],
        funnels: filterableData?.funnels ?? [],
      }}
    >
      {!isLoading && !isFilterableDataLoading && isInitialized ? (
        <Box mt={-3} pos="sticky" top={{ base: '44px', md: '122px', lg: '52px' }} zIndex="dropdown">
          <Flex pt={3} bg="bg.content" flexWrap="wrap" w="100%" columnGap={8} rowGap={4} align="center">
            <FilterContainer filterConfig={filterConfig} from="/p/$projectId/users" />
            <Flex flexGrow={1} gap={2.5} justify="flex-end">
              <AddFilterButton from="/p/$projectId/users" filterConfig={filterConfig} />
            </Flex>
          </Flex>
          <Box
            h={3}
            w="full"
            bg="linear-gradient(to bottom, var(--chakra-colors-bg-content) 20%, rgba(0, 0, 0, 0) 100%)"
          />
        </Box>
      ) : (
        <FilterSkeletons loading mb="3" />
      )}
      <Card.Root overflow="hidden" textStyle="sm" pos="relative">
        <Grid
          py={2.5}
          pr={2}
          gap={1}
          gridTemplateColumns={gridTemplateColumns}
          borderBottom="1px solid"
          borderColor="gray.emphasized"
          bg="gray.subtle/60"
          css={{ '& > div': { fontWeight: 'semibold' } }}
        >
          <Box hideBelow="md" w="30px" p={0}></Box>
          <Box pl={{ base: 2, md: 1 }} maxW={['60vw', 'none']}>
            User
          </Box>
          <Box>
            <Span hideBelow="md">Country</Span>
          </Box>
          <Box textAlign={{ base: 'right', md: 'left' }}>
            <UserSortPopover />
          </Box>
          <Box w="40px" hideBelow="md"></Box>
        </Grid>

        {!isLoading && isInitialized ? (
          users.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Text textStyle="sm" color="fg.muted">
                No users found for the selected filters
              </Text>
            </Box>
          ) : (
            <>
              {users.map(({ id, identifier, displayName, countryCode, lastSeenAt, isOnline }) => {
                return (
                  <Box
                    key={id}
                    borderBottom="1px solid"
                    borderColor="gray.emphasized"
                    _last={{ borderBottom: 'none' }}
                    bg="purple.muted"
                  >
                    <Grid
                      bg="bg.card"
                      pos="relative"
                      gridTemplateColumns={gridTemplateColumns}
                      py={2.5}
                      pr={2}
                      gap={1}
                      alignItems="center"
                      transition="all 0.2s ease-in-out"
                      _hover={{ bg: 'gray.subtle', transform: 'translateX(4px)' }}
                    >
                      <Box hideBelow="md" p={0}>
                        <Flex justify="center">
                          {isOnline ? (
                            <Tooltip content="The user is currently active">
                              <Status value="success" color="fg" gap={1.5} pos="relative" zIndex="5" />
                            </Tooltip>
                          ) : (
                            <Box
                              w="10px"
                              h="10px"
                              border="1.5px solid"
                              borderColor="gray.emphasized"
                              bg="gray.subtle"
                              rounded="full"
                            />
                          )}
                        </Flex>
                      </Box>
                      <Box pl={{ base: 2, md: 1 }} maxW={['60vw', 'none']}>
                        <Flex align="center" gap={2}>
                          <UserAvatar id={id} displayName={displayName} identifier={identifier} />
                          <LinkOverlay asChild zIndex="4" truncate _before={{ zIndex: 4 }}>
                            <Link to="/p/$projectId/users/$userId" params={{ projectId, userId: String(id) }}>
                              {getUserName(displayName, identifier)}
                            </Link>
                          </LinkOverlay>
                        </Flex>
                      </Box>
                      <Box>
                        <HStack justify={{ base: 'flex-end', md: 'flex-start' }}>
                          <CountryFlag countryCode={countryCode} />
                          <Text textStyle="sm" color="fg.muted" hideBelow="md">
                            {COUNTRIES[countryCode as keyof typeof COUNTRIES] ?? 'Unknown'}
                          </Text>
                        </HStack>
                      </Box>
                      <Box>
                        <Flex justify={{ base: 'flex-end', md: 'flex-start' }}>
                          <Tooltip
                            content={
                              lastSeenAt
                                ? sortConfig?.by?.type === 'event'
                                  ? `Last fired event at ${dateTimeFormatter.formatDateTime(lastSeenAt)}`
                                  : `Last seen at ${dateTimeFormatter.formatDateTime(lastSeenAt)}`
                                : 'Never fired this event'
                            }
                          >
                            <HStack
                              pos="relative"
                              zIndex="5"
                              gap={{ base: 2, md: 1 }}
                              flexDir={{ base: 'row-reverse', md: 'row' }}
                            >
                              <Icon>{lastSeenAt ? <TbClock /> : <TbClockOff />}</Icon>
                              <Text textStyle="sm" color="fg.muted">
                                {lastSeenAt ? (
                                  <>
                                    {dateTimeFormatter.formatDistanceNow(lastSeenAt, true)}{' '}
                                    <Span hideBelow="md">ago</Span>
                                  </>
                                ) : (
                                  'Never'
                                )}
                              </Text>
                            </HStack>
                          </Tooltip>
                        </Flex>
                      </Box>
                      <Box hideBelow="md">
                        <Flex justify="flex-end">
                          <Icon fontSize="lg" asChild>
                            <TbChevronRight />
                          </Icon>
                        </Flex>
                      </Box>
                    </Grid>
                  </Box>
                );
              })}

              <Flex align="center" justify="center" mt={4} pb={4} gap={4} textStyle="sm" fontWeight="medium">
                <IconButton
                  variant="surface"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={page === 1}
                  loading={isPreviousData && isFetching}
                >
                  <TbChevronLeft />
                </IconButton>
                <Text>Page {page}</Text>
                <IconButton
                  variant="surface"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={!hasNextPage}
                  loading={isPreviousData && isFetching}
                >
                  <TbChevronRight />
                </IconButton>
              </Flex>
            </>
          )
        ) : (
          <>
            {Array.from({ length: 5 }).map((_, index) => (
              <Box
                key={index}
                pr={2}
                borderBottom="1px solid"
                borderColor="gray.emphasized/70"
                _last={{ borderBottom: 'none' }}
              >
                <Grid pos="relative" gridTemplateColumns={gridTemplateColumns} alignItems="center" h="52px">
                  <Box />
                  <Box>
                    <Skeleton h="15px" w="80%" loading={isLoading} />
                  </Box>
                  <Flex justify={{ base: 'flex-end', sm: 'flex-start' }}>
                    <Skeleton h="15px" w="50%" loading={isLoading} />
                  </Flex>
                  <Box hideBelow="md">
                    <Skeleton h="15px" w="60%" loading={isLoading} />
                  </Box>
                  <Box hideBelow="md" />
                </Grid>
              </Box>
            ))}
          </>
        )}

        {isPreviousData && (
          <Box pos="absolute" inset="0" opacity="0.8" zIndex="docked">
            <Skeleton pos="absolute" inset="0" rounded="lg" />
          </Box>
        )}
      </Card.Root>

      {data && !isInitialized && <ProjectInitCard projectToken={data.projectToken} />}
    </FilterContextProvider>
  );
}
