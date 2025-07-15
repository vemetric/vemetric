import { Box, Portal, Text, Icon, Span, Card, Grid, Flex } from '@chakra-ui/react';
import { formatNumber, formatPercentage } from '@vemetric/common/math';
import { motion } from 'motion/react';
import React from 'react';
import { TbArrowNarrowRight, TbUserSquareRounded } from 'react-icons/tb';
import { ActiveUsersButton } from './active-users-button';

interface Props {
  activeUsersButtonRef: React.RefObject<HTMLDivElement>;
  funnelSteps: Array<{ users: number }>;
  activeUsersVisible: boolean;
  setActiveUsersVisible: (value: boolean) => void;
}

export const VerticalFunnel = (props: Props) => {
  const { activeUsersButtonRef, funnelSteps, activeUsersVisible, setActiveUsersVisible } = props;

  const activeUsers = funnelSteps[0].users;
  const maxUsers = Math.max(...funnelSteps.map((step) => step.users));

  return (
    <Box pos="relative" maxW="900px" mx="auto">
      <Portal container={activeUsersButtonRef}>
        <ActiveUsersButton
          activeUsers={activeUsers}
          activeUsersVisible={activeUsersVisible}
          setActiveUsersVisible={setActiveUsersVisible}
        />
      </Portal>

      <Card.Root py={4.5} px={4}>
        <Grid templateColumns="30px 1fr" columnGap={6}>
          {funnelSteps.map((step, index) => {
            const isUserStep = index === 0;
            const isFirstStep = isUserStep || (!activeUsersVisible && index === 1);
            const isLastStep = index === funnelSteps.length - 1;

            const isVisible = !isUserStep || activeUsersVisible;

            const previousUsers = isUserStep ? 0 : funnelSteps[index - 1].users;
            const lostUsers = isUserStep ? 0 : previousUsers - step.users;
            const convertedUsersPercentage = (step.users / previousUsers) * 100 || 0;
            const lostUsersPercentage = (lostUsers / previousUsers) * 100 || 0;
            const barWidthPercentage = (step.users / maxUsers) * 100;

            return (
              <React.Fragment key={index}>
                <motion.div
                  initial={{ height: isVisible ? '100%' : 0 }}
                  animate={{ height: isVisible ? '100%' : 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <Flex pos="relative" h="100%">
                    <Box pos="absolute" top="0" left="14px" w="2px" h="100%" bg="purple.400/20" />
                    {isLastStep && (
                      <Box
                        pos="absolute"
                        bottom="0"
                        left="0"
                        w="100%"
                        h="50%"
                        bg="linear-gradient(to bottom, transparent, var(--chakra-colors-bg-card) 80%)"
                      />
                    )}
                    <Flex
                      pos="absolute"
                      boxSize="30px"
                      align="center"
                      justify="center"
                      bg="bg.content"
                      borderRadius="full"
                      border="1.5px solid"
                      borderColor="purple.400/50"
                      fontSize={isUserStep ? 'lg' : 'sm'}
                      fontWeight="semibold"
                      boxShadow="sm"
                    >
                      {isUserStep ? <TbUserSquareRounded /> : index}
                    </Flex>
                  </Flex>
                </motion.div>
                <motion.div
                  initial={{ height: isVisible ? '100%' : 0 }}
                  animate={{ height: isVisible ? 'auto' : 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <Flex flexDir="column" gap={3} px="1px" pt={0.5} pb={isLastStep ? '20px' : '50px'}>
                    <Flex justify="space-between" align="center">
                      <Text fontWeight="semibold" fontSize="lg">
                        {isUserStep ? 'Active Users' : `Step ${index}`}
                      </Text>
                      {isFirstStep ? (
                        <Flex gap={1} align="center">
                          <TbUserSquareRounded />
                          <Text fontWeight="semibold">{formatNumber(step.users, true)}</Text>
                        </Flex>
                      ) : (
                        <Box />
                      )}
                    </Flex>

                    <Box
                      pos="relative"
                      h="35px"
                      borderRadius="lg"
                      bg="bg.content"
                      outline="1px solid"
                      outlineColor="purple.400/50"
                    >
                      <Box
                        pos="absolute"
                        top="0"
                        left="0"
                        h="100%"
                        zIndex={1}
                        w={`${barWidthPercentage}%`}
                        bg="linear-gradient(to right, rgb(59 130 246 / 70%), rgb(59 130 246 / 50%))"
                        borderRadius="lg"
                        transition="all 0.3s ease-out"
                      />
                    </Box>

                    <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4} px={2}>
                      <Flex gap={2} flexDir="column">
                        <Flex gap={2} align="center">
                          <Icon as={TbArrowNarrowRight} color="green.600" />
                          <Text>{formatNumber(step.users)} Users</Text>
                          {!isUserStep && <Span color="green.600">({formatPercentage(convertedUsersPercentage)})</Span>}
                        </Flex>
                        <Text fontSize="sm" opacity={0.7}>
                          {isUserStep ? 'Total Active Users' : 'Completed this Step'}
                        </Text>
                      </Flex>
                      {!isUserStep && (
                        <Flex gap={2} flexDir="column">
                          <Flex gap={2} align="center" justify={{ base: 'flex-start', md: 'flex-end' }}>
                            <Icon as={TbArrowNarrowRight} color="red.600" transform="rotate(45deg)" />
                            <Text>{formatNumber(lostUsers)} Users</Text>
                            <Span color="red.600">({formatPercentage(lostUsersPercentage)})</Span>
                          </Flex>
                          <Text fontSize="sm" opacity={0.7} textAlign={{ base: 'left', md: 'right' }}>
                            Dropped out
                          </Text>
                        </Flex>
                      )}
                    </Grid>
                  </Flex>
                </motion.div>
              </React.Fragment>
            );
          })}
        </Grid>
      </Card.Root>
    </Box>
  );
};
