import type { CardRootProps } from '@chakra-ui/react';
import { Flex, Box, Card, Clipboard, IconButton, Icon } from '@chakra-ui/react';
import { TbCheck, TbCopy } from 'react-icons/tb';

interface Props extends Omit<CardRootProps, 'children'> {
  children: string;
}

export function CodeBox({ children, ...props }: Props) {
  return (
    <Flex>
      <Clipboard.Root value={children}>
        <Clipboard.Trigger>
          <Card.Root {...props} className="group" pos="relative">
            <Card.Body
              justifyContent="center"
              color="orange.600"
              _dark={{ color: 'orange.400' }}
              minH="32px"
              overflow="auto"
              p="1.5"
            >
              <Box as="code" fontFamily="mono" whiteSpace="pre" fontSize="sm">
                {children}
              </Box>
            </Card.Body>
            <IconButton
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
