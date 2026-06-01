import { Card, CloseButton } from '@chakra-ui/react';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import type { MutableRefObject } from 'react';
import type { GlobeMarkerUser } from '@/utils/trpc';
import { trpc } from '@/utils/trpc';
import { GlobeMarkerUserDetail } from './globe-marker-user-detail';
import { GlobeMarkerUserList } from './globe-marker-user-list';

interface Props {
  projectId: string;
  timespan: TimeSpan;
  startDate?: string;
  endDate?: string;
  bucketIds: string[];
  userCount: number;
  markerUsers: Array<GlobeMarkerUser>;
  selectedUserId?: string | null;
  closeCard: () => void;
  selectUser: (userId: string) => void;
  showUserList: () => void;
  userListScrollOffsetRef: MutableRefObject<number>;
}

export const GlobeMarkerCard = (props: Props) => {
  const {
    projectId,
    timespan,
    startDate,
    endDate,
    bucketIds,
    userCount,
    selectedUserId: selectedUserIdFromProps,
    closeCard,
    selectUser,
    showUserList,
    userListScrollOffsetRef,
    markerUsers,
  } = props;

  const { data: bucketUsersData, isLoading: isBucketUsersLoading } = trpc.globe.getBucketUsers.useQuery({
    projectId,
    timespan,
    startDate,
    endDate,
    bucketIds,
  });
  const cardUsers = bucketUsersData?.users ?? markerUsers ?? [];
  const selectedUserId = selectedUserIdFromProps ?? (cardUsers.length === 1 ? cardUsers[0].id : null);
  const selectedUser = cardUsers.find((user) => user.id === selectedUserId);
  const showUserDetail = Boolean(selectedUserId);

  return (
    <Card.Root
      data-globe-wheel-ignore
      pos="absolute"
      width="400px"
      maxH="330px"
      left="calc(-25px)"
      top="calc(-60px)"
      bg="bg.card/80"
      outline="1.5px solid"
      outlineColor="bg"
      backdropFilter="blur(10px)"
      overflow="hidden"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onWheel={(e) => {
        e.stopPropagation();
      }}
      cursor="default"
      _dark={{
        outlineColor: 'bg.content',
      }}
    >
      <CloseButton onClick={closeCard} pos="absolute" right="0" top="0" size="xs" zIndex={3} />
      {showUserDetail ? (
        <GlobeMarkerUserDetail
          projectId={projectId}
          user={selectedUser}
          isSingleUser={userCount === 1}
          onBack={showUserList}
          isBucketUsersLoading={isBucketUsersLoading}
        />
      ) : (
        <GlobeMarkerUserList
          users={cardUsers}
          userCount={userCount}
          initialScrollOffset={userListScrollOffsetRef.current}
          onScrollOffsetChange={(scrollOffset) => {
            userListScrollOffsetRef.current = scrollOffset;
          }}
          onSelectUser={selectUser}
          isBucketUsersLoading={isBucketUsersLoading}
        />
      )}
    </Card.Root>
  );
};
