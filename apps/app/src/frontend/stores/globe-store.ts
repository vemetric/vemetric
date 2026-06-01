import { proxy, snapshot } from 'valtio';
import type { GlobeJoinedUser } from '@/utils/trpc';

const NOTIFICATION_DURATION = 5000;

export interface GlobeJoinNotification {
  id: string;
  createdAt: number;
  user: GlobeJoinedUser;
  dismissTimerId: number;
}

const defaultState = {
  joinedUsersSince: new Date().toISOString(),
  joinNotifications: [] as Array<GlobeJoinNotification>,
};

export const globeStore = proxy(defaultState);

export const globeStoreActions = {
  resetJoinedUsers: () => {
    globeStore.joinNotifications.forEach((notification) => {
      window.clearTimeout(notification.dismissTimerId);
    });
    globeStore.joinNotifications = [];
    globeStore.joinedUsersSince = new Date().toISOString();
  },
  setJoinedUsersSince: (since: string) => {
    globeStore.joinedUsersSince = since;
  },
  dismissNotification: (id: string) => {
    const notification = globeStore.joinNotifications.find((candidate) => candidate.id === id);
    if (notification) {
      window.clearTimeout(notification.dismissTimerId);
    }

    globeStore.joinNotifications = globeStore.joinNotifications.filter((notification) => notification.id !== id);
  },
  addNotifications: (newUsers: Array<GlobeJoinedUser>) => {
    const notifications = snapshot(globeStore).joinNotifications;
    const existingUserIds = new Set(notifications.map((notification) => notification.user.id));
    const createdAt = Date.now();

    const incomingNotifications = newUsers
      .map((user) => {
        const id = `${user.id}:${createdAt}`;

        return {
          id,
          createdAt,
          user,
          dismissTimerId: window.setTimeout(() => {
            globeStoreActions.dismissNotification(id);
          }, NOTIFICATION_DURATION),
        };
      })
      .filter((notification) => !existingUserIds.has(notification.user.id));

    globeStore.joinNotifications = [...notifications, ...incomingNotifications];
  },
};
