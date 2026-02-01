'use client';

import type { SpanProps } from '@chakra-ui/react';
import { Span } from '@chakra-ui/react';
import { vemetric } from '@vemetric/react';
import { ThemeProvider, useTheme } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';
import React from 'react';

export interface ColorModeProviderProps extends ThemeProviderProps {}

export function ColorModeProvider(props: ColorModeProviderProps) {
  return <ThemeProvider attribute="class" disableTransitionOnChange defaultTheme="system" {...props} />;
}

export type ColorMode = 'light' | 'dark';
export type ColorTheme = 'light' | 'dark' | 'system';

export interface UseColorModeReturn {
  colorMode: ColorMode;
  colorTheme: ColorTheme;
  setColorMode: (colorMode: ColorTheme, event?: React.MouseEvent) => void;
}

function setViewTransitionOrigin(event?: React.MouseEvent) {
  if (event) {
    const x = event.clientX;
    const y = event.clientY;
    document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
    document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);
  } else {
    // Default to center if no event
    document.documentElement.style.setProperty('--theme-toggle-x', '50%');
    document.documentElement.style.setProperty('--theme-toggle-y', '50%');
  }
}

function startViewTransition(callback: () => void, targetTheme: 'light' | 'dark', event?: React.MouseEvent) {
  // Check if View Transitions API is supported and user prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!document.startViewTransition || prefersReducedMotion) {
    callback();
    return;
  }

  // Set transition direction before starting
  const transitionDirection = targetTheme === 'dark' ? 'to-dark' : 'to-light';
  document.documentElement.dataset.themeTransition = transitionDirection;

  setViewTransitionOrigin(event);

  const transition = document.startViewTransition(callback);

  // Clean up after transition completes
  transition.finished.then(() => {
    delete document.documentElement.dataset.themeTransition;
  });
}

export function useColorMode(): UseColorModeReturn {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return {
    colorTheme: (theme ?? 'system') as ColorTheme,
    colorMode: resolvedTheme as ColorMode,
    setColorMode: (colorMode: ColorTheme, event?: React.MouseEvent) => {
      // Resolve target theme for the view transition animation
      let targetTheme: 'light' | 'dark';
      if (colorMode === 'system') {
        // Check system preference
        targetTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        targetTheme = colorMode;
      }

      const applyTheme = () => {
        vemetric.trackEvent('ChangeColorMode', { eventData: { colorMode }, userData: { set: { colorMode } } });
        setTheme(colorMode);
      };

      // Skip animation if resolved theme isn't changing
      if (targetTheme === resolvedTheme) {
        applyTheme();
        return;
      }

      startViewTransition(applyTheme, targetTheme, event);
    },
  };
}

export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode();
  return colorMode === 'dark' ? dark : light;
}

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
