import { Box } from '@chakra-ui/react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useSnapshot } from 'valtio';
import { useGlobeStore } from '@/stores/globe-store';

interface Props {
  isLoading: boolean;
  startDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

export const GlobeSurface = ({ isLoading, startDrag, children }: Props) => {
  const { store, refs } = useGlobeStore();
  const { locked, isDragging } = useSnapshot(store);

  return (
    <Box
      ref={refs.globeRootRef.setCurrent}
      w="100%"
      h="100%"
      overflow="hidden"
      pos="relative"
      touchAction="none"
      zIndex="0"
      cursor={locked ? 'default' : isDragging ? 'grabbing' : 'grab'}
      onPointerDown={startDrag}
      css={{
        '& canvas': {
          animation: isLoading ? 'pulse' : 'none',
        },
      }}
    >
      {children}
    </Box>
  );
};
