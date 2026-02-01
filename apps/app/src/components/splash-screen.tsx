import { Flex } from '@chakra-ui/react';
import { Logo } from './logo';

export const SplashScreen = () => {
  return (
    <Flex
      h="100dvh"
      w="100dvw"
      justify="center"
      align="center"
      animation="fade-in"
      animationDuration="2s"
      animationTimingFunction="ease-in-out"
    >
      <Flex
        animation="pulse"
        animationDuration="2s"
        animationTimingFunction="ease-in-out"
        animationIterationCount="infinite"
      >
        <Logo height="80px" asLink={false} />
      </Flex>
    </Flex>
  );
};
