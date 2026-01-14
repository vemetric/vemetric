import { Alert, Text, List } from '@chakra-ui/react';
import { TbCheck, TbX } from 'react-icons/tb';

interface Props {
  role: 'ADMIN' | 'MEMBER';
}

export const MemberRoleAlert = ({ role }: Props) => {
  return (
    <Alert.Root>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>
          <Text fontSize="sm" mb={2}>
            {role === 'ADMIN' ? 'Admins' : 'Members'} can:
          </Text>
          <List.Root fontSize="sm" variant="plain">
            <List.Item>
              <List.Indicator asChild color="green.500">
                <TbCheck />
              </List.Indicator>
              Access all projects in the organization{role === 'MEMBER' && ' (can be restricted to specific projects)'}
            </List.Item>
            <List.Item>
              {role === 'ADMIN' ? (
                <List.Indicator asChild color="green.500">
                  <TbCheck />
                </List.Indicator>
              ) : (
                <List.Indicator asChild color="red.500">
                  <TbX />
                </List.Indicator>
              )}
              Manage organization settings and billing infos
            </List.Item>
            <List.Item>
              {role === 'ADMIN' ? (
                <List.Indicator asChild color="green.500">
                  <TbCheck />
                </List.Indicator>
              ) : (
                <List.Indicator asChild color="red.500">
                  <TbX />
                </List.Indicator>
              )}
              Invite and manage other members
            </List.Item>
          </List.Root>
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};
