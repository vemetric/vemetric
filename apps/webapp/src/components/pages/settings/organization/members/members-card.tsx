import { Card, Box, Button, Flex, Text, Table, Badge, Avatar, AbsoluteCenter, Spinner } from '@chakra-ui/react';
import { useState } from 'react';
import { TbUsers, TbTrash, TbChevronDown } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';
import { RemoveMemberDialog } from './remove-member-dialog';

interface Props {
  organizationId: string;
}

export const MembersCard = (props: Props) => {
  const { organizationId } = props;
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string; email: string } | null>(null);

  const {
    data: membersData,
    refetch: refetchMembers,
    isLoading,
  } = trpc.organization.members.useQuery({ organizationId });

  const { mutate: mutateMemberRole } = trpc.organization.updateMemberRole.useMutation({
    onSuccess: () => {
      refetchMembers();
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

  const updateMemberRole = (params: Parameters<typeof mutateMemberRole>[0]) => {
    if (params.userId === membersData?.currentUserId) {
      toaster.create({
        title: 'Error',
        description: 'You cannot change your own role',
        type: 'error',
      });
      return;
    }
    mutateMemberRole(params);
  };

  const members = membersData?.members ?? [];
  const currentUserId = membersData?.currentUserId;

  return (
    <>
      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbUsers />
            </CardIcon>
            <Text fontWeight="semibold">Members</Text>
            {!isLoading && (
              <Badge ml="auto" colorPalette="purple">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Badge>
            )}
          </Flex>
        </Card.Header>
        <Card.Body>
          {isLoading ? (
            <Box h="100px" pos="relative">
              <AbsoluteCenter>
                <Spinner />
              </AbsoluteCenter>
            </Box>
          ) : (
            <Table.Root size="sm" variant="outline" rounded="md">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>User</Table.ColumnHeader>
                  <Table.ColumnHeader w="110px">Role</Table.ColumnHeader>
                  <Table.ColumnHeader w="100px">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {members.map((member) => {
                  const isCurrentUser = member.userId === currentUserId;
                  return (
                    <Table.Row key={member.userId} css={{ '&:last-of-type > td': { borderBottom: 'none' } }}>
                      <Table.Cell>
                        <Flex align="center" gap={3}>
                          <Avatar.Root size="sm">
                            <Avatar.Fallback>
                              {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase() || '?'}
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
                        <MenuRoot>
                          <MenuTrigger asChild>
                            <Button
                              variant="surface"
                              size="xs"
                              h="auto"
                              px={1.5}
                              py={1}
                              gap={0.5}
                              colorPalette={member.role === 'ADMIN' ? 'purple' : 'gray'}
                            >
                              {member.role}
                              <TbChevronDown />
                            </Button>
                          </MenuTrigger>
                          <MenuContent portalled={false}>
                            {member.role === 'MEMBER' && (
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
                            )}
                            {member.role === 'ADMIN' && (
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
                            )}
                          </MenuContent>
                        </MenuRoot>
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
                                email: member.user.email,
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
          )}
        </Card.Body>
      </Card.Root>

      <RemoveMemberDialog
        organizationId={organizationId}
        member={memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onSuccess={() => {
          refetchMembers();
          setMemberToRemove(null);
        }}
      />
    </>
  );
};
