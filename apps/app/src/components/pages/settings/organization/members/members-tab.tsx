import { Flex } from '@chakra-ui/react';
import { InvitationsCard } from './invitations-card';
import { MembersCard } from './members-card';

interface Props {
  organizationId: string;
}

export const OrganizationMembersTab = (props: Props) => {
  const { organizationId } = props;

  return (
    <Flex flexDir="column" gap={6}>
      <MembersCard />
      <InvitationsCard organizationId={organizationId} />
    </Flex>
  );
};
