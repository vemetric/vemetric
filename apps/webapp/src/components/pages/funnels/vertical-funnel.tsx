import { Box, Portal } from '@chakra-ui/react';
import { ActiveUsersButton } from './active-users-button';

interface Props {
  activeUsersButtonRef: React.RefObject<HTMLDivElement>;
  funnelSteps: Array<{ users: number }>;
  activeUsersVisible: boolean;
  setActiveUsersVisible: (value: boolean) => void;
}

export const VerticalFunnel = (props: Props) => {
  const { activeUsersButtonRef, funnelSteps, activeUsersVisible, setActiveUsersVisible } = props;

  const activeUsers = funnelSteps[0].users;

  return (
    <Box pos="relative">
      <Portal container={activeUsersButtonRef}>
        <ActiveUsersButton
          activeUsers={activeUsers}
          activeUsersVisible={activeUsersVisible}
          setActiveUsersVisible={setActiveUsersVisible}
        />
      </Portal>
      Vertical Funnel
    </Box>
  );
};
