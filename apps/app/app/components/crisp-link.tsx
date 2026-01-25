import type { LinkProps } from '@chakra-ui/react';
import { Link } from '@chakra-ui/react';
import { useOpenCrispChat } from '~/stores/crisp-chat-store';

export const CrispLink = (props: LinkProps) => {
  const openCrispChat = useOpenCrispChat();

  return (
    <Link
      as="span"
      textDecor="underline"
      textUnderlineOffset="3px"
      transition="opacity 0.2s ease-in-out"
      _hover={{ opacity: 0.7 }}
      onClick={() => openCrispChat()}
      {...props}
    />
  );
};
