import type { ButtonProps } from '@chakra-ui/react';
import { Button, Text } from '@chakra-ui/react';
import { MenuContent, MenuRadioItem, MenuRadioItemGroup, MenuRoot, MenuTrigger } from '../ui/menu';

export const OPERATOR_BUTTON_MENU_CLASS_NAME = 'operator-button-menu';

interface Props<T extends string> extends Omit<ButtonProps, 'onChange'> {
  operator: T;
  operators: Array<T>;
  onChange: (operator: T) => void;
}

export const OperatorButton = <T extends string>({ operator, operators, onChange, ...props }: Props<T>) => {
  return (
    <MenuRoot positioning={{ placement: 'bottom' }}>
      <MenuTrigger asChild>
        <Button
          variant="surface"
          rounded="sm"
          size="2xs"
          px={0.5}
          minW="0"
          py={0}
          _hover={{ borderColor: 'gray.emphasized' }}
          {...props}
        >
          {props.children || operator}
        </Button>
      </MenuTrigger>
      <MenuContent minW="0" zIndex="1502!important" className={OPERATOR_BUTTON_MENU_CLASS_NAME}>
        <MenuRadioItemGroup value={operator} onValueChange={({ value }) => onChange(value as T)}>
          {operators.map((operator) => (
            <MenuRadioItem key={operator} value={operator}>
              <Text>{operator}</Text>
            </MenuRadioItem>
          ))}
        </MenuRadioItemGroup>
      </MenuContent>
    </MenuRoot>
  );
};
