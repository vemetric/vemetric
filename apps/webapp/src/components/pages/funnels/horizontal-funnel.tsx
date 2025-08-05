import { Flex, Box, Text, Grid, Icon, Span } from '@chakra-ui/react';
import { formatNumber, formatPercentage } from '@vemetric/common/math';
import { motion } from 'motion/react';
import { useState } from 'react';
import { TbArrowNarrowRight, TbUserSquareRounded } from 'react-icons/tb';
import SimpleBar from 'simplebar-react';

const COLUMN_WIDTH = 303;
const BAR_HEIGHT = 380;
const TRANSITION = { bounce: false, duration: 0.4, ease: 'easeInOut' };

interface Props {
  activeUsersVisible: boolean;
  funnelSteps: Array<{ name: string; users: number }>;
}

export const HorizontalFunnel = (props: Props) => {
  const { activeUsersVisible, funnelSteps } = props;

  const [leftOverlayOpacity, setLeftOverlayOpacity] = useState(0);
  const [rightOverlayOpacity, setRightOverlayOpacity] = useState(1);

  const activeUsers = funnelSteps[0].users;
  const firstStepUsers = activeUsersVisible ? activeUsers : funnelSteps[1].users;

  return (
    <Box pos="relative">
      <SimpleBar
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
          pos="relative"
          templateColumns={`repeat(${
            activeUsersVisible ? funnelSteps.length : funnelSteps.length - 1
          }, ${COLUMN_WIDTH}px)`}
          mb={8}
        >
          {funnelSteps.map((step, index) => {
            const isUserStep = index === 0;
            const isFirstStep = isUserStep || (!activeUsersVisible && index === 1);
            const isLastStep = index === funnelSteps.length - 1;
            if (isUserStep && !activeUsersVisible) {
              return null;
            }

            const barPercentage = (step.users / firstStepUsers) * 100 || 0;
            const nextBarPercentage = isLastStep ? 0 : (funnelSteps[index + 1].users / firstStepUsers) * 100 || 0;

            const sameHeight = Math.abs(barPercentage - nextBarPercentage) < 5;
            const startY = 100 - barPercentage;
            const endY = 100 - nextBarPercentage;

            const baseUsers = activeUsersVisible ? activeUsers : firstStepUsers;
            const completedUsersPercentage = (step.users / baseUsers) * 100 || 0;

            return (
              <Flex
                key={activeUsersVisible ? index : index - 1}
                pos="relative"
                px="84px"
                align="flex-end"
                opacity={!isUserStep || activeUsersVisible ? 1 : 0}
                h={`${BAR_HEIGHT}px`}
                pt={5}
              >
                {!isLastStep && (
                  <Box pos="absolute" bottom={0} h="95%" w="63%" right="-31%" opacity={{ base: 0.15, _dark: 0.2 }}>
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 50 100"
                      preserveAspectRatio="none"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <motion.path
                        initial={{ d: 'M0 104 C0 104, 50 104, 50 104 L50 104 L0 104 Z' }}
                        animate={{
                          d: sameHeight
                            ? `M0 ${startY + 1.5} C0 ${startY + 1.5}, 50 ${endY + 1.5}, 50 ${endY + 1} L50 104 L0 104 Z`
                            : `M0 ${startY + 1.5} C12 ${startY + 1.5}, 30 ${endY}, 50 ${endY + 1} L50 104 L0 104 Z`,
                        }}
                        strokeWidth="2"
                        stroke="var(--chakra-colors-purple-500)"
                        fill="var(--chakra-colors-purple-500)"
                        transition={TRANSITION}
                      />
                    </svg>
                  </Box>
                )}
                <Flex flexDir="column" gap="1" justify="flex-end" h="100%">
                  <Flex
                    asChild
                    pos="relative"
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
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${barPercentage || 0}%` }}
                      transition={TRANSITION}
                    >
                      <Flex
                        gap="1"
                        align="center"
                        justify="center"
                        fontSize="sm"
                        fontWeight="semibold"
                        pos="absolute"
                        top="-26px"
                        right="-1px"
                        textAlign="center"
                        w="100%"
                      >
                        {isFirstStep ? (
                          <>
                            <TbUserSquareRounded /> {formatNumber(step.users, true)}
                          </>
                        ) : (
                          formatPercentage(completedUsersPercentage)
                        )}
                      </Flex>
                    </motion.div>
                  </Flex>
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
            const isLastStep = index === funnelSteps.length - 1;
            if (isUserStep && !activeUsersVisible) {
              return null;
            }

            const previousUsers = isUserStep ? 0 : funnelSteps[index - 1].users;
            const lostUsers = isUserStep ? 0 : previousUsers - step.users;
            const convertedUsersPercentage = (step.users / previousUsers) * 100 || 0;
            const lostUsersPercentage = (lostUsers / previousUsers) * 100 || 0;

            return (
              <Flex key={index} bg="linear-gradient(to bottom, var(--chakra-colors-bg-content) 50%, transparent 100%)">
                <Flex asChild flexDir="column" gap={2} pos="relative" py="4" px="45px" minH="200px" w="100%">
                  <motion.div
                    layout
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -100, opacity: 0 }}
                    transition={TRANSITION}
                  >
                    <Box
                      pos="absolute"
                      right="-14.5px"
                      top="60px"
                      w="30px"
                      h="30px"
                      roundedTopRight="3px"
                      borderTop="2px solid"
                      borderRight="2px solid"
                      borderColor="purple.400/80"
                      bg="bg.content"
                      transform="rotate(45deg)"
                      zIndex="1"
                      opacity={isLastStep ? 0 : 1}
                    />
                    <Box
                      pos="absolute"
                      top="0"
                      right="0"
                      w="2px"
                      h="100%"
                      bg="linear-gradient(to bottom, var(--chakra-colors-purple-400) 50%, transparent 100%)"
                      opacity={(isUserStep && !activeUsersVisible) || isLastStep ? 0 : 0.8}
                    />
                    <Text fontWeight="semibold" textAlign="center">
                      {step.name}
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
                  </motion.div>
                </Flex>
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
