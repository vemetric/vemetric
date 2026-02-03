import { Flex } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import {
  TbBrandAndroid,
  TbBrandApple,
  TbBrandChrome,
  TbBrandDebian,
  TbBrandFinder,
  TbBrandUbuntu,
  TbBrandWindows,
  TbBrandXbox,
  TbUser,
} from 'react-icons/tb';

interface Props {
  osName: string;
}

export function OsIcon({ osName }: Props) {
  let icon: ReactNode;

  switch (osName.replace(' ', '').toLowerCase()) {
    case 'android':
      icon = <TbBrandAndroid />;
      break;
    case 'chromeos':
      icon = <TbBrandChrome />;
      break;
    case 'debian':
      icon = <TbBrandDebian />;
      break;
    case 'linux':
      icon = <TbUser />;
      break;
    case 'macos':
      icon = <TbBrandFinder />;
      break;
    case 'ubuntu':
      icon = <TbBrandUbuntu />;
      break;
    case 'windowsmobile':
    case 'windows':
      icon = <TbBrandWindows />;
      break;
    case 'xbox':
      icon = <TbBrandXbox />;
      break;
    case 'ios':
      icon = <TbBrandApple />;
      break;
  }

  if (!icon) {
    return null;
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
