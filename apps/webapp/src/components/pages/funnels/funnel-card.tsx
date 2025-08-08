import { AspectRatio, Box, Card, Flex, Icon, Grid, Text, IconButton } from '@chakra-ui/react';
import { Link } from '@tanstack/react-router';
import { formatNumber, formatPercentage } from '@vemetric/common/math';
import { motion } from 'motion/react';
import { TbEdit, TbEye, TbTrash, TbUserSquareRounded } from 'react-icons/tb';
import { DeletePopover } from '@/components/delete-popover';
import { Tooltip } from '@/components/ui/tooltip';
import { trpc, type FunnelData } from '@/utils/trpc';
import { FunnelDialog } from './funnel-dialog';

interface Props {
  projectId: string;
  funnel: FunnelData;
  activeUsersVisible: boolean;
}

export const FunnelCard = ({ projectId, funnel, activeUsersVisible }: Props) => {
  const funnelSteps = funnel.stepResults;
  const activeUsers = funnelSteps[0].users;
  const firstStepUsers = activeUsersVisible ? activeUsers : funnelSteps[1].users;
  const lastStepUsers = funnelSteps[funnelSteps.length - 1].users;
  const completedPercentage = (lastStepUsers / activeUsers) * 100 || 0;

  const utils = trpc.useUtils();
  const { mutate: deleteFunnel, isLoading } = trpc.funnels.delete.useMutation({
    onSuccess: () => {
      utils.funnels.list.invalidate();
    },
  });

  return (
    <Card.Root
      overflow="hidden"
      rounded="xl"
      transition="all 0.2s ease-in-out"
      _hover={{ borderColor: 'purple.500/50' }}
      className="group"
    >
      <Card.Header pos="relative" py={1.5} borderBottom="1px solid" borderColor="gray.emphasized/50">
        <Flex justify="space-between" align="center">
          <Text fontSize="sm" fontWeight="semibold">
            {funnel.name}
          </Text>
          <Tooltip content={`${formatPercentage(completedPercentage)} of users completed this funnel`}>
            <Text fontSize="xs" fontWeight="semibold" opacity="0.8" zIndex="1">
              {formatPercentage(completedPercentage)}
            </Text>
          </Tooltip>
        </Flex>
      </Card.Header>
      <Card.Body p={0} pt={2.5} transition="all 0.2s ease-in-out" _groupHover={{ bg: 'gray.subtle/70' }}>
        <AspectRatio ratio={16 / 9}>
          <Flex h="100%" justify="flex-start!important" align="flex-end!important">
            <Grid
              templateColumns={`repeat(${activeUsersVisible ? funnelSteps.length : funnelSteps.length - 1}, 80px)`}
              alignItems="flex-end"
              h="90%"
              px={4}
            >
              {funnelSteps.map((step, index) => {
                const isFirstStep = activeUsersVisible ? index === 0 : index === 1;
                const isLastStep = index === funnelSteps.length - 1;

                if (index === 0 && !activeUsersVisible) {
                  return null;
                }

                const barPercentage = (step.users / firstStepUsers) * 100 || 0;
                const nextBarPercentage = isLastStep ? 0 : (funnelSteps[index + 1].users / firstStepUsers) * 100 || 0;

                const sameHeight = Math.abs(barPercentage - nextBarPercentage) < 5;
                const startY = 100 - barPercentage;
                const endY = 100 - nextBarPercentage;

                const completedPercentage = (step.users / firstStepUsers) * 100 || 0;

                return (
                  <Flex pos="relative" h="100%" w="100%" key={activeUsersVisible ? index : index - 1} align="flex-end">
                    {!isLastStep && (
                      <Box pos="absolute" h="100%" w="52%" right="-6%" opacity={{ base: 0.15, _dark: 0.2 }}>
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
                                ? `M0 ${startY + 1.5} C0 ${startY + 1.5}, 50 ${endY + 1.5}, 50 ${
                                    endY + 1
                                  } L50 104 L0 104 Z`
                                : `M0 ${startY + 1.5} C12 ${startY + 1.5}, 30 ${endY}, 50 ${endY + 1} L50 104 L0 104 Z`,
                            }}
                            strokeWidth="2"
                            stroke="var(--chakra-colors-purple-500)"
                            fill="var(--chakra-colors-purple-500)"
                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                          />
                        </svg>
                      </Box>
                    )}
                    <Box
                      asChild
                      pos="relative"
                      w="60%"
                      borderTopRadius="lg"
                      bg="linear-gradient(to top, rgb(59 130 246 / 50%), rgb(59 130 246 / 30%)), var(--chakra-colors-bg-card)"
                      border="1px solid"
                      borderColor="purple.400/60"
                      borderBottom="none"
                    >
                      <motion.div
                        animate={{ height: `${barPercentage || 0}%` }}
                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                      >
                        <Box
                          pos="absolute"
                          top="-16px"
                          right="-1px"
                          fontSize="2xs"
                          fontWeight="semibold"
                          textAlign="center"
                          w="100%"
                        >
                          {isFirstStep ? (
                            <Flex align="center" justify="center" gap={0.5} fontSize="xs" ml="-1" mt="-1">
                              <TbUserSquareRounded /> {formatNumber(step.users, true)}
                            </Flex>
                          ) : (
                            formatPercentage(completedPercentage)
                          )}
                        </Box>
                      </motion.div>
                    </Box>
                  </Flex>
                );
              })}
            </Grid>
          </Flex>
        </AspectRatio>
      </Card.Body>

      <Box asChild pos="absolute" inset={0}>
        <Link
          to="/p/$projectId/funnels/$funnelId"
          params={{ projectId, funnelId: funnel.id }}
          search={{ u: activeUsersVisible || undefined }}
        />
      </Box>

      <Flex
        pos="absolute"
        bottom={3}
        w="100%"
        justify="center"
        opacity="0"
        transform="translateY(10px)"
        transition="all 0.2s ease-in-out"
        _groupHover={{ opacity: 1, transform: 'translateY(0)' }}
      >
        <Flex align="center" gap={2.5}>
          <IconButton asChild variant="surface" size="sm" boxShadow="xs">
            <Link to="/p/$projectId/funnels/$funnelId" params={{ projectId, funnelId: funnel.id }}>
              <Icon as={TbEye} />
            </Link>
          </IconButton>
          <FunnelDialog funnelId={funnel.id}>
            <IconButton variant="surface" size="sm" boxShadow="xs">
              <Icon as={TbEdit} />
            </IconButton>
          </FunnelDialog>
          <DeletePopover
            text="Do you really want to delete this funnel?"
            onDelete={() => deleteFunnel({ projectId, id: funnel.id })}
            isLoading={isLoading}
            placement="top"
          >
            <IconButton variant="surface" size="sm" boxShadow="xs" color="red.fg">
              <Icon as={TbTrash} />
            </IconButton>
          </DeletePopover>
        </Flex>
      </Flex>
    </Card.Root>
  );
};
