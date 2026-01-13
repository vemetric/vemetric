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
          {role === 'ADMIN' ? (
            <>
              <Text fontSize="sm" mb={2}>
                Admins can:
              </Text>
              <List.Root fontSize="sm" variant="plain">
                <List.Item>
                  <List.Indicator asChild color="green.500">
                    <TbCheck />
                  </List.Indicator>
                  Access all projects in the organization
                </List.Item>
                <List.Item>
                  <List.Indicator asChild color="green.500">
                    <TbCheck />
                  </List.Indicator>
                  Manage organization settings and billing infos
                </List.Item>
                <List.Item>
                  <List.Indicator asChild color="green.500">
                    <TbCheck />
                  </List.Indicator>
                  Invite and manage other members
                </List.Item>
              </List.Root>
            </>
          ) : (
            <>
              <Text fontSize="sm" mb={2}>
                Members can:
              </Text>
              <List.Root fontSize="sm" variant="plain">
                <List.Item>
                  <List.Indicator asChild color="green.500">
                    <TbCheck />
                  </List.Indicator>
                  Access all projects and manage their settings (can be restricted to specific projects)
                </List.Item>
                <List.Item pl={3}>
                  <List.Indicator asChild color="green.500">
                    <TbCheck />
                  </List.Indicator>
                  View analytics and dashboards
                </List.Item>
                <List.Item pl={3}>
                  <List.Indicator asChild color="green.500">
                    <TbCheck />
                  </List.Indicator>
                  Manage and view funnels
                </List.Item>
                <List.Item>
                  <List.Indicator asChild color="red.500">
                    <TbX />
                  </List.Indicator>
                  Cannot manage organization settings or other members
                </List.Item>
              </List.Root>
            </>
          )}
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};
