import { useEffect, useRef } from 'react';
import { useColorMode } from '@/components/ui/color-mode';
import { useGlobeStore } from '@/stores/globe-store';
import { GLOBE_THEME_OPTIONS } from './globe-consts';

export const useGlobeThemeOptions = () => {
  const { actions } = useGlobeStore();
  const { colorMode } = useColorMode();
  const globeThemeOptions = GLOBE_THEME_OPTIONS[colorMode] ?? GLOBE_THEME_OPTIONS.light;
  const globeThemeOptionsRef = useRef(globeThemeOptions);

  useEffect(() => {
    globeThemeOptionsRef.current = globeThemeOptions;
    actions.updateGlobeTheme(globeThemeOptions);
  }, [globeThemeOptions, actions]);

  return {
    globeThemeOptionsRef,
  };
};
