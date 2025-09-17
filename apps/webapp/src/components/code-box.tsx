import type { CardRootProps } from '@chakra-ui/react';
import { Flex, Box, Card, Clipboard, IconButton, Icon } from '@chakra-ui/react';
import { TbCheck, TbCopy } from 'react-icons/tb';

interface Props extends Omit<CardRootProps, 'children'> {
  children: string;
  startElement?: React.ReactNode;
}

export function CodeBox({ children, startElement, w, ...props }: Props) {
  return (
    <Flex w={w ?? '100%'}>
      <Clipboard.Root value={children} w="100%">
        <Clipboard.Trigger w="100%">
          <Card.Root {...props} className="group" pos="relative">
            <Card.Body flexDir="row" alignItems="center" gap="2" minH="32px" overflow="auto" px="2" py="1.5">
              {startElement}
              <Box
                as="code"
                fontFamily="mono"
                whiteSpace="pre"
                fontSize="sm"
                color="orange.600"
                _dark={{ color: 'orange.400' }}
                userSelect="text"
              >
                {children}
              </Box>
            </Card.Body>
            <IconButton
              asChild
              pos="absolute"
              size="2xs"
              rounded="4px"
              top="5px"
              right="5px"
              variant="surface"
              display="none"
              _groupHover={{ display: 'flex' }}
            >
              <Clipboard.Indicator
                copied={
                  <Icon asChild color="green.500">
                    <TbCheck />
                  </Icon>
                }
              >
                <Icon asChild color="purple.500">
                  <TbCopy />
                </Icon>
              </Clipboard.Indicator>
            </IconButton>
          </Card.Root>
        </Clipboard.Trigger>
      </Clipboard.Root>
    </Flex>
  );
}
