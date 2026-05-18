import type { Globe } from 'cobe';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useColorMode } from '@/components/ui/color-mode';
import { GLOBE_THEME_OPTIONS } from './globe-consts';

interface Props {
  globeRef: RefObject<Globe | null>;
  offsetRef: RefObject<[number, number]>;
  rotationRef: RefObject<{ phi: number; theta: number }>;
}

export const useGlobeThemeOptions = ({ globeRef, offsetRef, rotationRef }: Props) => {
  const { colorMode } = useColorMode();
  const globeThemeOptions = GLOBE_THEME_OPTIONS[colorMode] ?? GLOBE_THEME_OPTIONS.light;
  const globeThemeOptionsRef = useRef(globeThemeOptions);

  useEffect(() => {
    globeRef.current?.update({ ...globeThemeOptions, offset: offsetRef.current ?? undefined, ...rotationRef.current });
  }, [globeThemeOptions, globeRef, offsetRef, rotationRef]);

  return {
    globeThemeOptionsRef,
  };
};
