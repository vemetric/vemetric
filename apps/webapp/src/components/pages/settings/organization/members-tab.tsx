import { Card, Box, Button, Flex, Text, AbsoluteCenter, Spinner, Table, Badge, Avatar } from '@chakra-ui/react';
import { useState } from 'react';
import { TbUsers, TbTrash } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/empty-state';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';

interface Props {
  organizationId: string;
}

export const OrganizationMembersTab = (props: Props) => {
  const { organizationId } = props;
  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const { data, error, refetch, isLoading: isMembersLoading } = trpc.organization.members.useQuery({ organizationId });

  const { mutate: removeMember, isPending: isRemoving } = trpc.organization.removeMember.useMutation({
    onSuccess: async () => {
      await refetch();
      setMemberToRemove(null);
      toaster.create({
        title: 'Member removed successfully',
        type: 'success',
      });
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  const { mutate: updateMemberRole } = trpc.organization.updateMemberRole.useMutation({
    onSuccess: async () => {
      await refetch();
      toaster.create({
        title: 'Role updated successfully',
        type: 'success',
      });
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  if (error) {
    return <ErrorState title="Error loading members" />;
  }

  if (isMembersLoading) {
    return (
      <Box h="200px" pos="relative">
        <AbsoluteCenter>
          <Spinner />
        </AbsoluteCenter>
      </Box>
    );
  }

  if (!data) {
    return <ErrorState title="Failed to load members" />;
  }

  const { currentUserId } = data;

  return (
    <Flex flexDir="column" gap={6}>
      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbUsers />
            </CardIcon>
            <Text fontWeight="semibold">Members</Text>
            <Badge ml="auto" colorPalette="purple">
              {data.members.length} {data.members.length === 1 ? 'member' : 'members'}
            </Badge>
          </Flex>
        </Card.Header>
        <Card.Body p={0}>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>User</Table.ColumnHeader>
                <Table.ColumnHeader>Role</Table.ColumnHeader>
                <Table.ColumnHeader w="100px">Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {data.members.map((member) => {
                const isCurrentUser = member.userId === currentUserId;
                return (
                  <Table.Row key={member.userId}>
                    <Table.Cell>
                      <Flex align="center" gap={3}>
                        <Avatar.Root size="sm">
                          <Avatar.Fallback>
                            {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
                          </Avatar.Fallback>
                          {member.user.image && <Avatar.Image src={member.user.image} />}
                        </Avatar.Root>
                        <Box>
                          <Text fontWeight="medium">
                            {member.user.name || 'Unnamed'}
                            {isCurrentUser && (
                              <Text as="span" color="fg.muted" fontWeight="normal">
                                {' '}
                                (you)
                              </Text>
                            )}
                          </Text>
                          <Text fontSize="sm" color="fg.muted">
                            {member.user.email}
                          </Text>
                        </Box>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      {!isCurrentUser ? (
                        <MenuRoot>
                          <MenuTrigger asChild>
                            <Button variant="ghost" size="xs">
                              <Badge colorPalette={member.role === 'ADMIN' ? 'purple' : 'gray'} cursor="pointer">
                                {member.role}
                              </Badge>
                            </Button>
                          </MenuTrigger>
                          <MenuContent>
                            <MenuItem
                              value="admin"
                              onClick={() =>
                                updateMemberRole({
                                  organizationId,
                                  userId: member.userId,
                                  role: 'ADMIN',
                                })
                              }
                            >
                              Make Admin
                            </MenuItem>
                            <MenuItem
                              value="member"
                              onClick={() =>
                                updateMemberRole({
                                  organizationId,
                                  userId: member.userId,
                                  role: 'MEMBER',
                                })
                              }
                            >
                              Make Member
                            </MenuItem>
                          </MenuContent>
                        </MenuRoot>
                      ) : (
                        <Badge colorPalette={member.role === 'ADMIN' ? 'purple' : 'gray'}>{member.role}</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {!isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="xs"
                          colorPalette="red"
                          onClick={() =>
                            setMemberToRemove({
                              userId: member.userId,
                              name: member.user.name || member.user.email,
                            })
                          }
                        >
                          <TbTrash />
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Card.Body>
      </Card.Root>

      {/* Remove Member Confirmation Dialog */}
      <DialogRoot open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text>
              Are you sure you want to remove <strong>{memberToRemove?.name}</strong> from this organization? They will
              lose access to all projects.
            </Text>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button
              colorPalette="red"
              loading={isRemoving}
              onClick={() => {
                if (memberToRemove) {
                  removeMember({
                    organizationId,
                    userId: memberToRemove.userId,
                  });
                }
              }}
            >
              Remove
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>
    </Flex>
  );
};
