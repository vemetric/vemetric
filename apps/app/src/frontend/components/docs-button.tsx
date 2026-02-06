import { Button, Icon, Link } from '@chakra-ui/react';
import { vemetric } from '@vemetric/react';
import { TbProgressHelp } from 'react-icons/tb';

interface Props {
  href: string;
  text?: string;
}

export const DocsButton = ({ href, text = 'Docs' }: Props) => (
  <Button
    asChild
    h="30px"
    px={2}
    mr="3px"
    size="sm"
    rounded="2xl"
    variant="surface"
    colorPalette="purple"
    gap={1.5}
    _hover={{ textDecoration: 'none' }}
    onClick={() => {
      vemetric.trackEvent('DocsButtonClicked');
    }}
  >
    <Link href={href} target="_blank">
      <Icon as={TbProgressHelp} boxSize="18px" />
      {text}
    </Link>
  </Button>
);
