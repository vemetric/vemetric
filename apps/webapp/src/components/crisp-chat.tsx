import { Button, Flex, Icon, Spinner } from '@chakra-ui/react';
import { TbMessageCircleQuestion } from 'react-icons/tb';
import { useIsCrispChatLoading, useOpenCrispChat } from '@/stores/crisp-chat-store';

export const CrispChat = () => {
  const openCrispChat = useOpenCrispChat();
  const isLoading = useIsCrispChatLoading();

  return (
    <Flex direction="column" pos="fixed" bottom={'30px'} zIndex="docked" pointerEvents="none" hideBelow="lg">
      <Button
        fontSize="2xl"
        left="25px"
        borderRadius="50%"
        boxSize="50px"
        bg="bg.card"
        border="0.5px solid"
        borderColor="gray.emphasized"
        boxShadow="lg"
        _active={{ boxShadow: 'inherit' }}
        aria-label="Chat with us!"
        color="fg"
        onClick={() => {
          openCrispChat(true);
        }}
        pointerEvents="auto"
      >
        <Icon as={isLoading ? Spinner : TbMessageCircleQuestion} />
      </Button>
    </Flex>
  );
};
