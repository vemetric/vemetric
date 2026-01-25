import { Button, Flex, Text } from '@chakra-ui/react';
import { formatNumber } from '@vemetric/common/math';
import { TbUserSquareRounded } from 'react-icons/tb';
import { Tooltip } from '@/components/ui/tooltip';

interface Props {
  activeUsers: number;
  activeUsersVisible: boolean;
  setActiveUsersVisible: (value: boolean) => void;
}

export const ActiveUsersButton = ({ activeUsers, activeUsersVisible, setActiveUsersVisible }: Props) => {
  return (
    <Tooltip
      content={
        <Flex flexDir="column" gap={1}>
          <Text>{formatNumber(activeUsers)} Active Users in the selected timeframe</Text>
          <Text>Click to toggle visibility in the funnel</Text>
        </Flex>
      }
      positioning={{ placement: 'right' }}
      closeOnClick={false}
      closeOnPointerDown={false}
    >
      <Button
        colorPalette={activeUsersVisible ? 'purple' : 'gray'}
        variant="surface"
        size="xs"
        rounded="full"
        onClick={() => setActiveUsersVisible(!activeUsersVisible)}
      >
        <TbUserSquareRounded /> Users ({formatNumber(activeUsers, true)})
      </Button>
    </Tooltip>
  );
};
