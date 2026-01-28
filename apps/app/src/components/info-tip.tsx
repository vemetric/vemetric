import { IconButton } from '@chakra-ui/react';
import * as React from 'react';
import { TbInfoCircle } from 'react-icons/tb';
import type { TooltipProps } from './ui/tooltip';
import { Tooltip } from './ui/tooltip';

export const InfoTip = React.forwardRef<
  HTMLDivElement,
  Partial<TooltipProps> & { tabIndex?: number; colorPalette?: string }
>(function InfoTip(props, ref) {
  const { tabIndex, colorPalette = 'gray', ...rest } = props;

  return (
    <Tooltip content={props.content} {...rest} closeOnClick={false} closeOnPointerDown={false} ref={ref}>
      <IconButton
        variant="ghost"
        aria-label="info"
        size="2xs"
        colorPalette={colorPalette}
        color={colorPalette === 'red' ? 'fg.error' : undefined}
        tabIndex={tabIndex}
      >
        <TbInfoCircle />
      </IconButton>
    </Tooltip>
  );
});
