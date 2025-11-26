import { Popover } from '@chakra-ui/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useState } from 'react';
import { TbChartFunnel } from 'react-icons/tb';
import type { CardIconProps } from './card-icon';
import { CardIcon } from './card-icon';
import { CustomIconStyle } from './custom-icon-style';
import { useColorMode } from './ui/color-mode';
import { MenuContent, MenuContextTrigger, MenuItem, MenuRoot } from './ui/menu';

interface Props extends CardIconProps {
  icon: string | null;
  onIconChange: (icon: string | null) => void;
}

export const FunnelIconButton = ({ icon, onIconChange, ...props }: Props) => {
  const { colorMode } = useColorMode();
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);

  let displayIcon: React.ReactNode = null;

  if (icon) {
    displayIcon = <CustomIconStyle transform="scale(0.85)">{icon}</CustomIconStyle>;
  } else {
    displayIcon = <TbChartFunnel />;
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
        <MenuContextTrigger onClick={(e) => e.stopPropagation()} {...{ type: 'button' }}>
          <Popover.Trigger asChild>
            <CardIcon cursor="pointer" lineHeight="1" p="2" onClick={(e) => e.stopPropagation()} {...props}>
              {displayIcon}
            </CardIcon>
          </Popover.Trigger>
        </MenuContextTrigger>
        <MenuContent portalled={false}>
          <MenuItem
            disabled={!icon}
            value="remove"
            onClick={(e) => {
              e.stopPropagation();
              onIconChange(null);
            }}
          >
            Remove custom icon
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      <Popover.Positioner>
        <Popover.Content onClick={(e) => e.stopPropagation()} rounded="lg">
          {emojiPopoverOpen && (
            <EmojiPicker
              theme={colorMode === 'dark' ? Theme.DARK : Theme.LIGHT}
              skinTonesDisabled
              onEmojiClick={(emoji) => {
                onIconChange?.(emoji.emoji);
                setEmojiPopoverOpen(false);
              }}
            />
          )}
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
};
