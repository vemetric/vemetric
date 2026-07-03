import { useEffect } from 'react';
import { useBaseDrag } from '@/hooks/use-base-drag';
import { useGlobeStore } from '@/stores/globe-store';
import type { GlobeUserBucket } from '@/utils/trpc';

interface Props {
  buckets: Array<GlobeUserBucket>;
}

export const useGlobeController = ({ buckets }: Props) => {
  const {
    refs: { globeRootRef },
    actions,
  } = useGlobeStore();

  useEffect(() => {
    actions.setBuckets(buckets);
  }, [buckets, actions]);

  useEffect(() => {
    const saveIntervalId = window.setInterval(actions.saveGlobeViewState, 1000);

    return () => {
      window.clearInterval(saveIntervalId);
      actions.saveGlobeViewState();
    };
  }, [actions]);

  useEffect(() => {
    actions.startAnimation();

    return actions.stopAnimation;
  }, [actions]);

  const startDrag = useBaseDrag({
    draggingTolerance: 5,
    onDragStart: (e) => {
      return actions.beginDrag(e.clientX, e.clientY);
    },
    onDrag: (e) => {
      actions.drag(e.clientX, e.clientY);
    },
    onDragEnd: actions.endDrag,
  });

  useEffect(() => {
    const globeRoot = globeRootRef.current;
    if (!globeRoot) return;

    globeRoot.addEventListener('wheel', actions.handleWheel, { passive: false });

    return () => {
      globeRoot.removeEventListener('wheel', actions.handleWheel);
    };
  }, [globeRootRef, actions.handleWheel]);

  return { startDrag };
};
