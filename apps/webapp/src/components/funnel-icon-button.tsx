import { Box, Popover, Portal } from '@chakra-ui/react';
import EmojiPicker from 'emoji-picker-react';
import { useState } from 'react';
import { TbChartFunnel } from 'react-icons/tb';
import type { CardIconProps } from './card-icon';
import { CardIcon } from './card-icon';
import { MenuContent, MenuContextTrigger, MenuItem, MenuRoot } from './ui/menu';

interface Props extends CardIconProps {
  icon?: string | null;
  onIconChange?: (icon: string) => void;
  onIconRemove?: () => void;
  readOnly?: boolean;
}

export const FunnelIconButton = ({ icon, onIconChange, onIconRemove, readOnly = false, ...props }: Props) => {
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);

  let displayIcon: React.ReactNode = null;

  if (icon) {
    displayIcon = (
      <Box transform="scale(0.85)" filter="grayscale(0.3)" opacity={0.9}>
        {icon}
      </Box>
    );
  } else {
    displayIcon = <TbChartFunnel />;
  }

  // If readonly, just show the icon without interaction
  if (readOnly || (!onIconChange && !onIconRemove)) {
    return (
      <CardIcon lineHeight="1" {...props}>
        {displayIcon}
      </CardIcon>
    );
  }

  return (
    <Popover.Root
      positioning={{ placement: 'bottom-start' }}
      open={emojiPopoverOpen}
      onOpenChange={({ open }) => {
        setEmojiPopoverOpen(open);
      }}
    >
      <MenuRoot>
        <MenuContextTrigger onClick={(e) => e.stopPropagation()}>
          <Popover.Trigger asChild>
            <CardIcon cursor="pointer" lineHeight="1" onClick={(e) => e.stopPropagation()} {...props}>
              {displayIcon}
            </CardIcon>
          </Popover.Trigger>
        </MenuContextTrigger>
        <MenuContent>
          <MenuItem
            disabled={!icon}
            value="remove"
            onClick={(e) => {
              e.stopPropagation();
              onIconRemove?.();
            }}
          >
            Remove custom icon
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      <Portal>
        <Popover.Positioner>
          <Popover.Content onClick={(e) => e.stopPropagation()} rounded="lg">
            {emojiPopoverOpen && (
              <EmojiPicker
                skinTonesDisabled
                onEmojiClick={(emoji) => {
                  onIconChange?.(emoji.emoji);
                  setEmojiPopoverOpen(false);
                }}
              />
            )}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
