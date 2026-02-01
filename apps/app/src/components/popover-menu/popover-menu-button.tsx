import { Button, type ButtonProps } from '@chakra-ui/react';

export const PopoverMenuButton = (props: ButtonProps) => (
  <Button
    variant="ghost"
    bg="bg"
    size="sm"
    textAlign="left"
    px={2}
    rounded="none"
    justifyContent="flex-start"
    transition="transform 0.2s ease-out"
    _hover={{ transform: 'translateX(3px)' }}
    {...props}
  />
);
