import { useRef } from 'react';
import { TbSun, TbMoon, TbDeviceLaptop } from 'react-icons/tb';
import type { ColorTheme } from './ui/color-mode';
import { useColorMode } from './ui/color-mode';
import { SegmentedControl } from './ui/segmented-control';

export const ThemeSwitch = () => {
  const { colorTheme, setColorMode } = useColorMode();
  const lastClickEvent = useRef<React.MouseEvent | null>(null);

  return (
    <SegmentedControl
      size="xs"
      value={colorTheme}
      onMouseDown={(e: React.MouseEvent) => {
        lastClickEvent.current = e;
      }}
      onValueChange={(e) => {
        setColorMode(e.value as ColorTheme, lastClickEvent.current ?? undefined);
        lastClickEvent.current = null;
      }}
      items={[
        { value: 'light', label: <TbSun /> },
        { value: 'dark', label: <TbMoon /> },
        { value: 'system', label: <TbDeviceLaptop /> },
      ]}
    />
  );
};
