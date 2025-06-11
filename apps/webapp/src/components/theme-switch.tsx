import { TbSun, TbMoon, TbDeviceLaptop } from 'react-icons/tb';
import type { ColorMode } from './ui/color-mode';
import { useColorMode } from './ui/color-mode';
import { SegmentedControl } from './ui/segmented-control';

export const ThemeSwitch = () => {
  const { colorTheme, setColorMode } = useColorMode();

  return (
    <SegmentedControl
      size="xs"
      value={colorTheme}
      onValueChange={(e) => setColorMode(e.value as ColorMode)}
      items={[
        { value: 'light', label: <TbSun /> },
        { value: 'dark', label: <TbMoon /> },
        { value: 'system', label: <TbDeviceLaptop /> },
      ]}
    />
  );
};
