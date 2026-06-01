import { Button, Text } from '@chakra-ui/react';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { globeStore, globeStoreActions } from '@/stores/globe-store';
import { trpc, type GlobeJoinedUser } from '@/utils/trpc';
import { UserAvatar } from '../user/user-avatar';

const JOINED_USERS_REFETCH_INTERVAL = 5_000;
const MAX_NOTIFICATIONS = 2;

interface Props {
  projectId: string;
  timespan: TimeSpan;
  startDate?: string;
  endDate?: string;
  isInitialized: boolean;
  onSelectUser: (user: GlobeJoinedUser) => void;
}

export const GlobeJoinNotifications = (props: Props) => {
  const { projectId, timespan, startDate, endDate, isInitialized, onSelectUser } = props;
  const joinedUsersSince = useSnapshot(globeStore).joinedUsersSince;
  const notifications = useSnapshot(globeStore).joinNotifications;
  const slicedNotifications = notifications.slice(-MAX_NOTIFICATIONS);
  const otherCount = notifications.length - MAX_NOTIFICATIONS;
  const rangeKey = `${projectId}:${timespan}:${startDate ?? ''}:${endDate ?? ''}`;

  useEffect(() => {
    globeStoreActions.resetJoinedUsers();
  }, [rangeKey]);

  trpc.globe.getJoinedUsersSince.useQuery(
    { projectId, timespan, startDate, endDate, since: joinedUsersSince },
    {
      enabled: isInitialized,
      refetchInterval: JOINED_USERS_REFETCH_INTERVAL,
      onSuccess: (joinedUsers) => {
        globeStoreActions.addNotifications(joinedUsers.users);
        globeStoreActions.setJoinedUsersSince(joinedUsers.nextSince);
      },
    },
  );

  return (
    <AnimatePresence>
      {otherCount > 0 && (
        <motion.div
          style={{ originX: 0, originY: 0 }}
          initial={{ opacity: 0, scale: 0.85, translateY: -30 }}
          animate={{ scale: 0.85, translateY: -46, translateX: 2, opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeInOut', bounce: 0, delay: 0.05 }}
          exit={{ opacity: 0, translateX: -20, transition: { duration: 0.3, bounce: 0 } }}
        >
          <Text color="fg.muted" textStyle="xs" fontWeight="medium" lineHeight="shorter">
            +{otherCount} other{otherCount > 1 && 's'}
          </Text>
        </motion.div>
      )}
      {slicedNotifications.map((notification, index) => {
        const { user } = notification;

        let transform = { scale: 1, translateY: -4 };
        if (slicedNotifications.length === 2 && index === 0) {
          transform = { scale: 0.85, translateY: -24 };
        }

        return (
          <Button
            asChild
            key={notification.id}
            position="absolute"
            left="0"
            bottom="0"
            variant="ghost"
            h="auto"
            justifyContent="flex-start"
            p={0.5}
            gap={1.5}
            onClick={() => {
              globeStoreActions.dismissNotification(notification.id);
              onSelectUser(user);
            }}
            pointerEvents="auto"
            zIndex={index * -1}
          >
            <motion.button
              style={{ originX: 0, originY: 0 }}
              initial={{ opacity: 0, translateX: -20, ...transform }}
              animate={{ ...transform, translateX: 0, opacity: 1 }}
              transition={{ duration: 0.1, ease: 'easeInOut', bounce: 0, delay: 0.05 }}
              exit={{ opacity: 0, translateX: -20, transition: { duration: 0.3, bounce: 0 } }}
            >
              <UserAvatar
                enableBlink
                id={user.id}
                identifier={user.identifier}
                displayName={user.displayName}
                avatarUrl={user.avatarUrl}
                boxSize="16px"
              />
              <Text color="fg.muted" textStyle="xs" fontWeight="medium" lineHeight="shorter">
                New user
              </Text>
            </motion.button>
          </Button>
        );
      })}
    </AnimatePresence>
  );
};
