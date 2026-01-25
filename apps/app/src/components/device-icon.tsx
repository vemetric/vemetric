import { Flex } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import {
  TbDeviceDesktop,
  TbDeviceGamepad,
  TbDeviceMobile,
  TbDeviceTablet,
  TbDeviceTvOld,
  TbDeviceWatch,
  TbQuestionMark,
  TbServer,
} from 'react-icons/tb';

interface Props {
  deviceType: string;
}

export function DeviceIcon({ deviceType }: Props) {
  let icon: ReactNode;

  switch (deviceType) {
    case 'desktop':
      icon = <TbDeviceDesktop />;
      break;
    case 'mobile':
      icon = <TbDeviceMobile />;
      break;
    case 'tablet':
      icon = <TbDeviceTablet />;
      break;
    case 'console':
      icon = <TbDeviceGamepad />;
      break;
    case 'server':
      icon = <TbServer />;
      break;
    case 'smarttv':
      icon = <TbDeviceTvOld />;
      break;
    case 'wearable':
      icon = <TbDeviceWatch />;
      break;
    default:
      icon = <TbQuestionMark />;
  }

  return (
    <Flex
      align="center"
      justify="center"
      flexShrink={0}
      boxSize="18px"
      bg="gray.subtle"
      rounded="4px"
      color="gray.fg"
      overflow="hidden"
    >
      {icon}
    </Flex>
  );
}
