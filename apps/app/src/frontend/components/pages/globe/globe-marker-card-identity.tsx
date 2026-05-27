import { Flex, Heading, Text } from '@chakra-ui/react';
import { motion } from 'motion/react';
import { LocationLabel } from '@/components/location-label';
import { Status } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/tooltip';
import type { GlobeMarkerUser, GlobeBucketUser } from '@/utils/trpc';
import { getUserName } from '@/utils/user';

interface Props {
  user: GlobeMarkerUser | GlobeBucketUser;
  isOnline: boolean;
  displayName?: string;
  variant?: 'list' | 'detail';
}

export const GlobeMarkerCardIdentity = ({ user, isOnline, displayName, variant = 'list' }: Props) => {
  const userName = displayName ?? getUserName(user.displayName, user.identifier);

  return (
    <motion.div
      layoutId={`globe-marker-identity-${user.id}`}
      transition={{ duration: 0.18, ease: 'easeInOut' }}
      style={{ position: 'relative', zIndex: 3 }}
    >
      <Flex flexDirection="column" gap={0.5} minW={0} textAlign="left" lineHeight="shorter" pos="relative" zIndex={2}>
        <Flex align="center" gap={2}>
          {variant === 'detail' ? (
            <Heading size="sm" truncate>
              {userName}
            </Heading>
          ) : (
            <Text fontWeight="medium" truncate>
              {userName}
            </Text>
          )}
          {isOnline && (
            <Tooltip content="The user is currently active">
              <Status value="success" color="fg" gap={1.5} pos="relative" flexShrink={0} mr={1} />
            </Tooltip>
          )}
        </Flex>
        <LocationLabel fontSize="xs" color="fg.muted" countryCode={user.countryCode} city={user.city} />
      </Flex>
    </motion.div>
  );
};
