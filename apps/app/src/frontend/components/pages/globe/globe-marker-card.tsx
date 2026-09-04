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
  const bucketUsers = bucketUsersData?.users ?? [];
  const cardUsers = bucketUsers.length > 0 ? bucketUsers : markerUsers;
  const selectedUserId = selectedUserIdFromProps ?? (cardUsers.length === 1 ? cardUsers[0].id : null);
  const selectedUser = cardUsers.find((user) => user.id === selectedUserId);

  return (
    <Card.Root
      data-globe-wheel-ignore
      pos={['fixed', undefined, 'absolute']}
      width={['calc(100dvw - 24px)', undefined, '400px']}
      maxH={['min(420px, calc(100dvh - 32px))', undefined, '330px']}
      left={['50%', undefined, 'calc(-25px)']}
      top={['50%', undefined, 'calc(-60px)']}
      maxW={{ mdDown: '400px' }}
      transform={{ mdDown: 'translate(-50%, -50%)' }}
      zIndex={{ mdDown: 20 }}
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
      {selectedUserId ? (
        <GlobeMarkerUserDetail
          projectId={projectId}
          userId={selectedUserId}
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
          hasMoreUsers={Boolean(bucketUsersData?.hasMore)}
        />
      )}
    </Card.Root>
  );
};
