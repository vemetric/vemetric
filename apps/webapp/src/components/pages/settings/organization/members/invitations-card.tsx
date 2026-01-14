import { Card, Box, Button, Flex, Text, Table, Badge, IconButton, AbsoluteCenter, Spinner } from '@chakra-ui/react';
import { isInvitationExpired } from '@vemetric/common/organization';
import { useState } from 'react';
import { TbTrash, TbCopy, TbUserPlus, TbLink } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { toaster } from '@/components/ui/toaster';
import { dateTimeFormatter } from '@/utils/date-time-formatter';
import { trpc } from '@/utils/trpc';
import { getAppUrl } from '@/utils/url';
import { CreateInvitationMenu } from './create-invitation-menu';
import { MemberBadge } from './member-badge';
import { RevokeInvitationDialog } from './revoke-invitation-dialog';

interface Props {
  organizationId: string;
}

export const InvitationsCard = (props: Props) => {
  const { organizationId } = props;
  const [invitationToRevoke, setInvitationToRevoke] = useState<string | null>(null);

  const {
    data: invitationsData,
    refetch: refetchInvitations,
    isLoading,
  } = trpc.organization.invitations.useQuery({ organizationId });

  const invitations = invitationsData?.invitations ?? [];
  const activeInvitations = invitations.filter((inv) => !isInvitationExpired(inv.createdAt));

  const copyInviteLink = async (token: string) => {
    const inviteUrl = `${getAppUrl()}/invite/${token}`;
    await navigator.clipboard.writeText(inviteUrl);
    toaster.create({
      title: 'Invitation link copied to clipboard',
      type: 'success',
    });
  };

  return (
    <>
      <Card.Root>
        <Card.Header>
          <Flex align="center" gap={2}>
            <CardIcon>
              <TbLink />
            </CardIcon>
            <Text fontWeight="semibold">Pending Invitations</Text>
            <Box flexGrow={1} mr={2}>
              {!isLoading && activeInvitations.length > 0 && (
                <Badge colorPalette="orange">{activeInvitations.length} pending</Badge>
              )}
            </Box>
            <CreateInvitationMenu organizationId={organizationId}>
              <Button aria-label="Create Invite Link" size="xs" colorPalette="purple">
                <TbUserPlus />
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
          ) : invitations.length === 0 ? (
            <Box p={6} textAlign="center">
              <Text color="fg.muted" fontSize="sm">
                No pending invitations. Create an invite link to add new members.
              </Text>
            </Box>
          ) : (
            <Table.Root size="sm" variant="outline" rounded="md">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Link</Table.ColumnHeader>
                  <Table.ColumnHeader w="100px">Role</Table.ColumnHeader>
                  <Table.ColumnHeader w="130px">Status</Table.ColumnHeader>
                  <Table.ColumnHeader w="120px">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {invitations.map((invitation) => {
                  const expired = isInvitationExpired(invitation.createdAt);
                  return (
                    <Table.Row
                      key={invitation.token}
                      css={{ '&:last-of-type > td': { borderBottom: 'none' } }}
                      opacity={expired ? 0.6 : 1}
                    >
                      <Table.Cell>
                        <Button
                          variant="ghost"
                          rounded="none"
                          px="1"
                          py="0.5"
                          h="auto"
                          maxW="200px"
                          color={expired ? 'fg.muted' : 'purple.fg'}
                          lineClamp={1}
                          textDecoration={expired ? 'line-through' : undefined}
                          _hover={{ bg: expired ? 'gray.subtle' : 'purple.subtle' }}
                          onClick={() => copyInviteLink(invitation.token)}
                          disabled={expired}
                        >
                          {`/invite/${invitation.token}`}
                        </Button>
                      </Table.Cell>
                      <Table.Cell>
                        <MemberBadge role={invitation.role} />
                      </Table.Cell>
                      <Table.Cell>
                        {expired ? (
                          <Badge colorPalette="red">Expired</Badge>
                        ) : (
                          <Text fontSize="sm" color="fg.muted">
                            {dateTimeFormatter.formatDate(invitation.createdAt)}
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap={1}>
                          {!expired && (
                            <IconButton
                              aria-label="Copy invite link"
                              variant="ghost"
                              size="xs"
                              onClick={() => copyInviteLink(invitation.token)}
                            >
                              <TbCopy />
                            </IconButton>
                          )}
                          <IconButton
                            aria-label="Revoke invitation"
                            variant="ghost"
                            size="xs"
                            colorPalette="red"
                            onClick={() => setInvitationToRevoke(invitation.token)}
                          >
                            <TbTrash />
                          </IconButton>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </Card.Body>
      </Card.Root>

      <RevokeInvitationDialog
        organizationId={organizationId}
        token={invitationToRevoke}
        onClose={() => setInvitationToRevoke(null)}
        onSuccess={() => {
          refetchInvitations();
          setInvitationToRevoke(null);
        }}
      />
    </>
  );
};
