import { Box, Icon, IconButton } from '@chakra-ui/react';
import { TbLock, TbLockOpen, TbPlayerPause, TbPlayerPlay, TbZoomReset } from 'react-icons/tb';
import { useSnapshot } from 'valtio';
import { useGlobeStore } from '@/stores/globe-store';

export const GlobeControls = () => {
  const { store, actions } = useGlobeStore();
  const { autoRotate, locked } = useSnapshot(store);

  return (
    <Box pos="absolute" top={3} left={3} zIndex="2" display="flex" gap={2} pointerEvents="none">
      <IconButton
        aria-label={locked ? 'Unlock globe interaction' : 'Lock globe interaction'}
        size="xs"
        variant="surface"
        onClick={actions.toggleLocked}
        pointerEvents="auto"
      >
        <Icon as={locked ? TbLock : TbLockOpen} />
      </IconButton>
      <IconButton
        aria-label={autoRotate ? 'Pause globe rotation' : 'Start globe rotation'}
        size="xs"
        variant="surface"
        onClick={actions.toggleAutoRotate}
        pointerEvents="auto"
      >
        <Icon as={autoRotate ? TbPlayerPause : TbPlayerPlay} />
      </IconButton>
      <IconButton
        aria-label="Reset globe zoom"
        size="xs"
        variant="surface"
        onClick={actions.resetGlobeZoom}
        pointerEvents="auto"
      >
        <Icon as={TbZoomReset} />
      </IconButton>
    </Box>
  );
};
