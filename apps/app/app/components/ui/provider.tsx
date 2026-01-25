'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { vemetricTheme } from '~/style/theme';
import { ColorModeProvider, type ColorModeProviderProps } from './color-mode';

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={vemetricTheme}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  );
}
