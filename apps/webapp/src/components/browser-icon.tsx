import { Flex } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import {
  TbAtom,
  TbBrandAndroid,
  TbBrandChrome,
  TbBrandEdge,
  TbBrandFacebook,
  TbBrandFirefox,
  TbBrandInstagram,
  TbBrandLinkedin,
  TbBrandOpera,
  TbBrandSafari,
  TbBrandVivaldi,
  TbBrandWechat,
  TbBrandYandex,
} from 'react-icons/tb';

interface Props {
  browserName: string;
}

export function BrowserIcon({ browserName }: Props) {
  let icon: ReactNode;

  switch (browserName.replace(' ', '').toLowerCase()) {
    case 'chrome':
    case 'chromewebview':
    case 'chromeheadless':
    case 'chromium':
    case 'mobilechrome':
      icon = <TbBrandChrome />;
      break;
    case 'androidbrowser':
      icon = <TbBrandAndroid />;
      break;
    case 'electron':
      icon = <TbAtom />;
      break;
    case 'edge':
      icon = <TbBrandEdge />;
      break;
    case 'facebook':
      icon = <TbBrandFacebook />;
      break;
    case 'mozilla':
    case 'firefox':
    case 'mobilefirefox':
      icon = <TbBrandFirefox />;
      break;
    case 'instagram':
      icon = <TbBrandInstagram />;
      break;
    case 'linkedin':
      icon = <TbBrandLinkedin />;
      break;
    case 'opera':
    case 'operatouch':
    case 'operagx':
      icon = <TbBrandOpera />;
      break;
    case 'mobilesafari':
    case 'safari':
      icon = <TbBrandSafari />;
      break;
    case 'vivaldi':
      icon = <TbBrandVivaldi />;
      break;
    case 'wechat':
      icon = <TbBrandWechat />;
      break;
    case 'yandex':
      icon = <TbBrandYandex />;
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
