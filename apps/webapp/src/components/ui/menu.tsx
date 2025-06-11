'use client';

import { AbsoluteCenter, Box, Menu as ChakraMenu, Portal } from '@chakra-ui/react';
import * as React from 'react';
import { TbCheck, TbChevronRight } from 'react-icons/tb';
interface MenuContentProps extends ChakraMenu.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
}

export const MenuContent = React.forwardRef<HTMLDivElement, MenuContentProps>(function MenuContent(props, ref) {
  const { portalled = true, portalRef, zIndex, ...rest } = props;
  return (
    <Portal disabled={!portalled} container={portalRef}>
      <ChakraMenu.Positioner zIndex={zIndex}>
        <ChakraMenu.Content ref={ref} {...rest} />
      </ChakraMenu.Positioner>
    </Portal>
  );
});

export const MenuArrow = React.forwardRef<HTMLDivElement, ChakraMenu.ArrowProps>(function MenuArrow(props, ref) {
  return (
    <ChakraMenu.Arrow ref={ref} {...props}>
      <ChakraMenu.ArrowTip />
    </ChakraMenu.Arrow>
  );
});

export const MenuCheckboxItem = React.forwardRef<HTMLDivElement, ChakraMenu.CheckboxItemProps>(
  function MenuCheckboxItem(props, ref) {
    return (
      <ChakraMenu.CheckboxItem ps="34px" rounded="sm" ref={ref} {...props}>
        <AbsoluteCenter
          axis="horizontal"
          insetStart="4"
          border="1px solid"
          borderColor="gray.500"
          rounded="md"
          boxSize="20px"
          color="purple.400"
          _light={{ borderColor: 'gray.400', color: 'purple.500' }}
        >
          <Box asChild inset="2px" transform="none">
            <ChakraMenu.ItemIndicator>
              <TbCheck strokeWidth={2.5} />
            </ChakraMenu.ItemIndicator>
          </Box>
        </AbsoluteCenter>
        {props.children}
      </ChakraMenu.CheckboxItem>
    );
  },
);

export const MenuRadioItem = React.forwardRef<HTMLDivElement, ChakraMenu.RadioItemProps>(
  function MenuRadioItem(props, ref) {
    const { children, ...rest } = props;
    return (
      <ChakraMenu.RadioItem ps="8" ref={ref} {...rest}>
        <AbsoluteCenter axis="horizontal" insetStart="4" asChild>
          <ChakraMenu.ItemIndicator color="purple.500">
            <TbCheck />
          </ChakraMenu.ItemIndicator>
        </AbsoluteCenter>
        <ChakraMenu.ItemText>{children}</ChakraMenu.ItemText>
      </ChakraMenu.RadioItem>
    );
  },
);

export const MenuItemGroup = React.forwardRef<
  HTMLDivElement,
  Omit<ChakraMenu.ItemGroupProps, 'title'> & { title: React.ReactNode }
>(function MenuItemGroup(props, ref) {
  const { title, children, ...rest } = props;
  return (
    <ChakraMenu.ItemGroup ref={ref} {...rest}>
      {title && <ChakraMenu.ItemGroupLabel userSelect="none">{title}</ChakraMenu.ItemGroupLabel>}
      {children}
    </ChakraMenu.ItemGroup>
  );
});

export interface MenuTriggerItemProps extends ChakraMenu.ItemProps {
  startIcon?: React.ReactNode;
}

export const MenuTriggerItem = React.forwardRef<HTMLDivElement, MenuTriggerItemProps>(
  function MenuTriggerItem(props, ref) {
    const { startIcon, children, ...rest } = props;
    return (
      <ChakraMenu.TriggerItem ref={ref} {...rest}>
        {startIcon}
        {children}
        <TbChevronRight />
      </ChakraMenu.TriggerItem>
    );
  },
);

export const MenuRadioItemGroup = ChakraMenu.RadioItemGroup;
export const MenuContextTrigger = ChakraMenu.ContextTrigger;
export const MenuRoot = ChakraMenu.Root;
export const MenuSeparator = ChakraMenu.Separator;

export const MenuItem = ChakraMenu.Item;
export const MenuItemText = ChakraMenu.ItemText;
export const MenuItemCommand = ChakraMenu.ItemCommand;
export const MenuTrigger = ChakraMenu.Trigger;
