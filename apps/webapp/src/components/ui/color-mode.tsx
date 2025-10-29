'use client';

import type { IconButtonProps, SpanProps } from '@chakra-ui/react';
import { IconButton, Span } from '@chakra-ui/react';
import { vemetric } from '@vemetric/react';
import { ThemeProvider, useTheme } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';
import React from 'react';
import { TbSun, TbMoon } from 'react-icons/tb';

export interface ColorModeProviderProps extends ThemeProviderProps {}

export function ColorModeProvider(props: ColorModeProviderProps) {
  return <ThemeProvider attribute="class" disableTransitionOnChange defaultTheme="system" {...props} />;
}

export type ColorMode = 'light' | 'dark';
export type ColorTheme = 'light' | 'dark' | 'system';

export interface UseColorModeReturn {
  colorMode: ColorMode;
  colorTheme: ColorTheme;
  setColorMode: (colorMode: ColorMode) => void;
  toggleColorMode: () => void;
}

export function useColorMode(): UseColorModeReturn {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const toggleColorMode = () => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  };
  return {
    colorTheme: (theme ?? 'system') as ColorTheme,
    colorMode: resolvedTheme as ColorMode,
    setColorMode: (colorMode: ColorMode) => {
      vemetric.trackEvent('ChangeColorMode', { eventData: { colorMode }, userData: { set: { colorMode } } });
      setTheme(colorMode);
    },
    toggleColorMode,
  };
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode();
  return colorMode === 'dark' ? dark : light;
}

interface ColorModeButtonProps extends Omit<IconButtonProps, 'aria-label'> {}

export const ColorModeButton = React.forwardRef<HTMLButtonElement, ColorModeButtonProps>(
  function ColorModeButton(props, ref) {
    const { toggleColorMode, colorMode } = useColorMode();
    return (
      <IconButton
        onClick={toggleColorMode}
        variant="surface"
        aria-label="Toggle color mode"
        size="xs"
        ref={ref}
        {...props}
        css={{
          _icon: {
            width: '4.5',
            height: '4.5',
          },
        }}
      >
        {colorMode === 'dark' ? <TbMoon /> : <TbSun />}
      </IconButton>
    );
  },
);

export const LightMode = React.forwardRef<HTMLSpanElement, SpanProps>(function LightMode(props, ref) {
  return (
    <Span
      color="fg"
      display="contents"
      className="chakra-theme light"
      colorPalette="gray"
      colorScheme="light"
      ref={ref}
      {...props}
    />
  );
});

export const DarkMode = React.forwardRef<HTMLSpanElement, SpanProps>(function DarkMode(props, ref) {
  return (
    <Span
      color="fg"
      display="contents"
      className="chakra-theme dark"
      colorPalette="gray"
      colorScheme="dark"
      ref={ref}
      {...props}
    />
  );
});
