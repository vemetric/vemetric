import type { FlexProps } from '@chakra-ui/react';
import { Flex, Box, Text, Grid, Icon, Span, Portal } from '@chakra-ui/react';
import { formatNumber, formatPercentage } from '@vemetric/common/math';
import { useEffect, useRef, useState } from 'react';
import { TbArrowNarrowRight, TbUserSquareRounded } from 'react-icons/tb';
import SimpleBar from 'simplebar-react';
import { ActiveUsersButton } from './active-users-button';

const FunnelCard = (props: FlexProps) => (
  <Flex
    flexDir="column"
    align="center"
    justify="center"
    bg="linear-gradient(to top, rgb(59 130 246 / 50%), rgb(59 130 246 / 30%)), var(--chakra-colors-bg-card)"
    border="1.5px solid"
    borderColor="purple.400"
    w="135px"
    borderTopRadius="2xl"
    gap={2}
    zIndex={1}
    {...props}
  />
);

const COLUMN_WIDTH = 303;
const MIN_BAR_HEIGHT = 200;
const MAX_BAR_HEIGHT = 380;
const TRANSITION_MS = 400;
const TRANSITION = `all ${TRANSITION_MS}ms ease-out`;

function getBarHeight(users: number, activeUsers: number) {
  return (users / activeUsers) * MAX_BAR_HEIGHT;
}

interface Props {
  activeUsersButtonRef: React.RefObject<HTMLDivElement>;
  funnelSteps: Array<{ users: number }>;
  activeUsersVisible: boolean;
  setActiveUsersVisible: (value: boolean) => void;
}

export const HorizontalFunnel = (props: Props) => {
  const {
    activeUsersButtonRef,
    funnelSteps,
    activeUsersVisible,
    setActiveUsersVisible: _setActiveUsersVisible,
  } = props;

  const scrollRef = useRef<any>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [isAnimating, setIsAnimating] = useState(false);
  const [hideActiveUsers, setHideActiveUsers] = useState(!activeUsersVisible);
  const [leftOverlayOpacity, setLeftOverlayOpacity] = useState(0);
  const [rightOverlayOpacity, setRightOverlayOpacity] = useState(1);

  const activeUsers = funnelSteps[0].users;
  const firstStepHeight = getBarHeight(funnelSteps[1].users, activeUsers);
  const firstHeightDiff = MAX_BAR_HEIGHT - Math.max(firstStepHeight, MIN_BAR_HEIGHT - 25);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    grid.style.transition = hideActiveUsers ? 'none' : TRANSITION;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveUsersVisible = (value: boolean) => {
    const grid = gridRef.current;
    if (!grid || isAnimating) return;

    setIsAnimating(true);
    if (value) {
      scrollRef.current?.getScrollElement()?.scrollTo(0, 0);
      setHideActiveUsers(false);
    }

    setTimeout(() => {
      if (value) {
        // we enable transition after added the grid to the DOM
        grid.style.transition = TRANSITION;
      }
      _setActiveUsersVisible(value);

      setTimeout(() => {
        scrollRef.current?.recalculate();
        if (!value) {
          // the grid should disable transitions when it's removed from the DOM
          grid.style.transition = 'none';
          setHideActiveUsers(true);
        }
        setIsAnimating(false);
      }, TRANSITION_MS + 100);
    }, 1);
  };

  return (
    <Box pos="relative">
      <Portal container={activeUsersButtonRef}>
        <ActiveUsersButton
          activeUsers={activeUsers}
          activeUsersVisible={activeUsersVisible}
          setActiveUsersVisible={setActiveUsersVisible}
        />
      </Portal>
      <SimpleBar
        ref={scrollRef}
        scrollableNodeProps={{
          onScroll: (e: any) => {
            const target = e.target as HTMLElement;
            const scrollLeft = target.scrollLeft;
            const scrollWidth = target.scrollWidth;
            const clientWidth = target.clientWidth;

            // Calculate scroll position percentages, only fade in last 10%
            const leftPercentage = Math.min(1, scrollLeft / (0.1 * (scrollWidth - clientWidth)));
            const rightPercentage = Math.min(
              1,
              (scrollWidth - clientWidth - scrollLeft) / (0.1 * (scrollWidth - clientWidth)),
            );

            setLeftOverlayOpacity(leftPercentage);
            setRightOverlayOpacity(rightPercentage);
          },
        }}
      >
        <Grid
          ref={gridRef}
          pos="relative"
          transform={
            activeUsersVisible || hideActiveUsers
              ? 'translate(0, 0)'
              : `translate(-${COLUMN_WIDTH}px, -${firstHeightDiff}px)`
          }
          templateColumns={`repeat(${
            hideActiveUsers ? funnelSteps.length - 1 : funnelSteps.length
          }, ${COLUMN_WIDTH}px)`}
          mb={8}
        >
          {funnelSteps.map((step, index) => {
            const isUserStep = index === 0;
            const isFirstStep = isUserStep || (!activeUsersVisible && index === 1);
            const isLastStep = index === funnelSteps.length - 1;
            if (isUserStep && hideActiveUsers) {
              return null;
            }

            const height = getBarHeight(step.users, activeUsers);
            const nextHeight = isLastStep ? 0 : getBarHeight(funnelSteps[index + 1].users, activeUsers);
            const startY = MAX_BAR_HEIGHT - height;
            const endY = MAX_BAR_HEIGHT - nextHeight;
            const sameHeight = Math.abs(height - nextHeight) < 5;

            const previousUsers = isUserStep ? 0 : funnelSteps[index - 1].users;
            const lostUsers = isUserStep ? 0 : previousUsers - step.users;
            const lostUsersPercentage = (lostUsers / previousUsers) * 100 || 0;

            return (
              <Flex
                key={index}
                pos="relative"
                px="84px"
                align="flex-end"
                opacity={!isUserStep || activeUsersVisible ? 1 : 0}
                transition={TRANSITION}
                minH={`${MIN_BAR_HEIGHT}px`}
              >
                {!isLastStep && (
                  <Box pos="absolute" right="-100px" opacity={{ base: 0.15, _dark: 0.2 }}>
                    <svg
                      width="200px"
                      height={MAX_BAR_HEIGHT}
                      viewBox={`0 2 200 ${MAX_BAR_HEIGHT}`}
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d={
                          sameHeight
                            ? `M0 ${startY + 3} L200 ${endY + 3} L200 404 L0 404 Z`
                            : `M0 ${startY + 3} C45 ${startY + 10}, 70 ${endY}, 200 ${endY + 3} L200 404 L0 404 Z`
                        }
                        strokeWidth="2"
                        stroke="var(--chakra-colors-purple-500)"
                        fill="var(--chakra-colors-purple-500)"
                      />
                    </svg>
                  </Box>
                )}
                <Flex flexDir="column" gap="1">
                  <Flex
                    gap="1"
                    align="center"
                    justify="center"
                    fontSize="sm"
                    fontWeight="semibold"
                    color={isFirstStep || lostUsersPercentage <= 0 ? undefined : 'red.500'}
                  >
                    {isFirstStep ? (
                      <>
                        <TbUserSquareRounded /> {formatNumber(step.users, true)}
                      </>
                    ) : (
                      formatPercentage(-lostUsersPercentage)
                    )}
                  </Flex>
                  <FunnelCard h={`${height}px`} />
                </Flex>
                <Box
                  pos="absolute"
                  left="6"
                  bottom={0}
                  zIndex={1}
                  w="100%"
                  h="1.5px"
                  bg={
                    isFirstStep || isLastStep
                      ? `linear-gradient(to ${
                          isFirstStep ? 'right' : 'left'
                        }, transparent 0%, var(--chakra-colors-purple-400) 10%, var(--chakra-colors-purple-400) 100%)`
                      : 'purple.400'
                  }
                />
              </Flex>
            );
          })}
          {funnelSteps.map((step, index) => {
            const isUserStep = index === 0;
            const isFirstStep = isUserStep || (!activeUsersVisible && index === 1);
            const isLastStep = index === funnelSteps.length - 1;
            if (isUserStep && hideActiveUsers) {
              return null;
            }

            const previousUsers = isUserStep ? 0 : funnelSteps[index - 1].users;
            const lostUsers = isUserStep ? 0 : previousUsers - step.users;
            const convertedUsersPercentage = (step.users / previousUsers) * 100 || 0;
            const lostUsersPercentage = (lostUsers / previousUsers) * 100 || 0;

            return (
              <Flex
                key={index}
                bg="linear-gradient(to bottom, var(--chakra-colors-bg-content) 50%, transparent 100%)"
                flexDir="column"
                gap={2}
                py="4"
                px="45px"
                pos="relative"
                minH="200px"
              >
                <Box
                  pos="absolute"
                  left="-15.5px"
                  top="60px"
                  w="30px"
                  h="30px"
                  roundedTopRight="3px"
                  borderTop="2px solid"
                  borderRight="2px solid"
                  borderColor="purple.400/80"
                  bg="bg.content"
                  transform="rotate(45deg)"
                  opacity={isFirstStep ? 0 : 1}
                  transition={TRANSITION}
                />
                <Box
                  pos="absolute"
                  top="0"
                  right="0"
                  w="2px"
                  h="100%"
                  bg="linear-gradient(to bottom, var(--chakra-colors-purple-400) 50%, transparent 100%)"
                  opacity={(isUserStep && !activeUsersVisible) || isLastStep ? 0 : 0.8}
                  transition={TRANSITION}
                />
                <Text fontWeight="semibold" textAlign="center">
                  {isUserStep ? 'Active Users' : `Step ${index}`}
                </Text>
                <Grid templateColumns="20px 1fr" alignItems="center" gap={1} my={3}>
                  <Icon as={TbArrowNarrowRight} color="green.600" />
                  <Text>
                    {formatNumber(step.users)} Users
                    {!isUserStep && <Span color="green.600"> ({formatPercentage(convertedUsersPercentage)})</Span>}
                  </Text>
                  <Box />
                  <Text fontSize="sm" opacity={0.5}>
                    {isUserStep ? 'Total Active Users' : 'Completed this Step'}
                  </Text>
                </Grid>
                {!isUserStep && (
                  <Grid templateColumns="20px 1fr" alignItems="center" gap={1} mb={3}>
                    <Icon as={TbArrowNarrowRight} color="red.600" transform="rotate(45deg)" />
                    <Text>
                      {formatNumber(lostUsers)} Users{' '}
                      <Span color="red.600">({formatPercentage(lostUsersPercentage)})</Span>
                    </Text>
                    <Box />
                    {isUserStep ? (
                      <Box />
                    ) : (
                      <Text fontSize="sm" opacity={0.5}>
                        Dropped out
                      </Text>
                    )}
                  </Grid>
                )}
              </Flex>
            );
          })}
        </Grid>
      </SimpleBar>
      <Box
        pos="absolute"
        top="0"
        left="0"
        h="100%"
        w="100px"
        bg="linear-gradient(to left, transparent 0%, var(--chakra-colors-bg-content) 75%)"
        opacity={leftOverlayOpacity}
        transition="opacity 0.2s ease-out"
      />
      <Box
        pos="absolute"
        top="0"
        right="0"
        h="100%"
        w="100px"
        bg="linear-gradient(to right, transparent 0%, var(--chakra-colors-bg-content) 75%)"
        opacity={rightOverlayOpacity}
        transition="opacity 0.2s ease-out"
      />
    </Box>
  );
};
