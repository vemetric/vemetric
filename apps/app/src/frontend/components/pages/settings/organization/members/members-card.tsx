import { Card, Box, Button, Flex, Text, Table, Badge, AbsoluteCenter, Spinner } from '@chakra-ui/react';
import React, { useState } from 'react';
import { TbUsers, TbTrash, TbChevronDown, TbChevronRight, TbFolders, TbUserPlus } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { UserIdentity } from '@/components/user-identity';
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { trpc } from '@/utils/trpc';
import { ChangeRoleDialog } from './change-role-dialog';
import { CreateInvitationMenu } from './create-invitation-menu';
import { MemberProjectAccess } from './member-project-access';
import { ProjectAccessBadge } from './project-access-badge';
import { RemoveMemberDialog } from './remove-member-dialog';

export const MembersCard = () => {
  const { organizationId } = useCurrentOrganization();
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string; email: string } | null>(null);
  const [memberToChangeRole, setMemberToChangeRole] = useState<{
    userId: string;
    name: string;
    currentRole: 'ADMIN' | 'MEMBER';
    newRole: 'ADMIN' | 'MEMBER';
  } | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const {
    data: membersData,
    refetch: refetchMembers,
    isLoading,
  } = trpc.organization.members.useQuery({ organizationId });

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
            <Box flexGrow={1} />
            {!isLoading && (
              <Badge colorPalette="purple">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Badge>
            )}
            <CreateInvitationMenu organizationId={organizationId}>
              <Button aria-label="Create Invite Link" size="xs" colorPalette="purple">
                <TbUserPlus />
                Invite
              </Button>
            </CreateInvitationMenu>
          </Flex>
        </Card.Header>
        <Card.Body overflow="auto">
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
                  <Table.ColumnHeader w="130px">Role</Table.ColumnHeader>
                  <Table.ColumnHeader w="100px">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {members.map((member) => {
                  const isCurrentUser = member.userId === currentUserId;
                  const isExpanded = expandedMemberId === member.userId;
                  const canExpand = true;

                  return (
                    <React.Fragment key={member.userId}>
                      <Table.Row
                        css={{
                          '&:last-of-type > td': { borderBottom: isExpanded ? undefined : 'none' },
                          cursor: canExpand ? 'pointer' : 'default',
                        }}
                        onClick={() => {
                          if (canExpand) {
                            setExpandedMemberId(isExpanded ? null : member.userId);
                          }
                        }}
                      >
                        <Table.Cell>
                          <Flex align="center" gap={3}>
                            {canExpand && (
                              <Box color="fg.muted">{isExpanded ? <TbChevronDown /> : <TbChevronRight />}</Box>
                            )}
                            <UserIdentity
                              mode="stacked"
                              avatarSize="sm"
                              name={member.user.name}
                              email={member.user.email}
                              image={member.user.image}
                              primaryLabel={member.user.name || 'Unnamed'}
                              isCurrentUser={isCurrentUser}
                            />
                          </Flex>
                        </Table.Cell>
                        <Table.Cell>
                          <Flex direction="column" gap={1} align="flex-start">
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
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {member.role}
                                  <TbChevronDown />
                                </Button>
                              </MenuTrigger>
                              <MenuContent
                                portalled={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                {member.role === 'MEMBER' && (
                                  <MenuItem
                                    value="admin"
                                    onClick={() =>
                                      setMemberToChangeRole({
                                        userId: member.userId,
                                        name: member.user.name || member.user.email,
                                        currentRole: 'MEMBER',
                                        newRole: 'ADMIN',
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
                                      setMemberToChangeRole({
                                        userId: member.userId,
                                        name: member.user.name || member.user.email,
                                        currentRole: 'ADMIN',
                                        newRole: 'MEMBER',
                                      })
                                    }
                                  >
                                    Make Member
                                  </MenuItem>
                                )}
                              </MenuContent>
                            </MenuRoot>
                            <ProjectAccessBadge projectAccess={member.projectAccess} />
                          </Flex>
                        </Table.Cell>
                        <Table.Cell>
                          <Flex gap={1}>
                            {canExpand && (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedMemberId(isExpanded ? null : member.userId);
                                }}
                                title="Configure project access"
                              >
                                <TbFolders />
                              </Button>
                            )}
                            {!isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="xs"
                                colorPalette="red"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMemberToRemove({
                                    userId: member.userId,
                                    name: member.user.name || member.user.email,
                                    email: member.user.email,
                                  });
                                }}
                              >
                                <TbTrash />
                              </Button>
                            )}
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                      {isExpanded && (
                        <Table.Row>
                          <Table.Cell colSpan={3} p={0}>
                            <MemberProjectAccess
                              userId={member.userId}
                              userName={member.user.name || member.user.email}
                              role={member.role}
                              isCurrentUser={isCurrentUser}
                              onClose={() => setExpandedMemberId(null)}
                            />
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </React.Fragment>
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

      <ChangeRoleDialog
        organizationId={organizationId}
        member={memberToChangeRole}
        onClose={() => setMemberToChangeRole(null)}
        onSuccess={() => {
          refetchMembers();
          setExpandedMemberId(null);
          setMemberToChangeRole(null);
        }}
      />
    </>
  );
};
