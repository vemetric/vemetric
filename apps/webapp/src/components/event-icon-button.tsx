import { Box, Popover, Portal } from '@chakra-ui/react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useState } from 'react';
import { TbBolt, TbEye, TbExternalLink } from 'react-icons/tb';
import { useProjectContext } from '@/contexts/project-context';
import type { CardIconProps } from './card-icon';
import { CardIcon } from './card-icon';
import { useColorMode } from './ui/color-mode';
import { MenuContent, MenuContextTrigger, MenuItem, MenuRoot } from './ui/menu';

interface Props extends CardIconProps {
  name: string;
}

export const EventIconButton = ({ name, ...props }: Props) => {
  const { colorMode } = useColorMode();
  const { eventIcons, setEventIcon, removeEventIcon } = useProjectContext();
  const contextEmoji = eventIcons[name];
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);

  let icon: React.ReactNode = null;
  if (name === '$$pageView') {
    icon = <TbEye />;
  } else if (name === '$$outboundLink') {
    icon = <TbExternalLink />;
  }

  if (icon !== null) {
    return (
      <CardIcon lineHeight="1" {...props}>
        {icon}
      </CardIcon>
    );
  }

  if (contextEmoji) {
    icon = (
      <Box transform="scale(0.85)" filter="grayscale(0.3)" opacity={0.9}>
        {contextEmoji}
      </Box>
    );
  } else {
    icon = <TbBolt />;
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
              {icon}
            </CardIcon>
          </Popover.Trigger>
        </MenuContextTrigger>
        <MenuContent>
          <MenuItem
            disabled={!contextEmoji}
            value="remove"
            onClick={(e) => {
              e.stopPropagation();
              removeEventIcon(name);
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
                theme={colorMode === 'dark' ? Theme.DARK : Theme.LIGHT}
                skinTonesDisabled
                onEmojiClick={(emoji) => {
                  setEventIcon(name, emoji.emoji);
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
