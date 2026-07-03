import type { Globe } from 'cobe';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { proxy, ref, snapshot } from 'valtio';
import {
  DEFAULT_GLOBE_AUTO_ROTATE,
  DEFAULT_GLOBE_LOCKED,
  GLOBE_RESET_DURATION,
  GLOBE_ZOOM_SPEED,
  ROTATION_SPEED,
  ZOOM_IN_THETA_PULL,
  ZOOM_OUT_THETA_PULL,
  type GlobeThemeOptions,
  type GlobeConfig,
} from '@/components/pages/globe/globe-consts';
import type { GlobeRotation } from '@/components/pages/globe/globe-utils';
import {
  clampGlobeOffset,
  clampNumber,
  clampTheta,
  easeOutCubic,
  getCursorFocusOffset,
  getDragSensitivity,
  getFocusedRotation,
  getInitialGlobeViewState,
  getLocationRotation,
  getPreferredTheta,
  getZoomCursorPull,
  interpolateOffset,
  interpolateRotation,
  setMarkerScale,
} from '@/components/pages/globe/globe-utils';
import { getThemeTransitioning, subscribeThemeTransition } from '@/components/ui/color-mode';
import { toaster } from '@/components/ui/toaster';
import type { GlobeViewState } from '@/utils/local-storage';
import { globeViewState } from '@/utils/local-storage';
import type { GlobeJoinedUser, GlobePanelUser, GlobeUserBucket } from '@/utils/trpc';

const NOTIFICATION_DURATION = 5000;
const GLOBE_WHEEL_IGNORE_SELECTOR = '[data-globe-wheel-ignore]';

interface GlobeJoinNotification {
  id: string;
  createdAt: number;
  user: GlobeJoinedUser;
  dismissTimerId: number;
}

interface GlobePointerState {
  x: number;
  y: number;
  phi: number;
  theta: number;
}

interface GlobeRefs {
  config: GlobeConfig;
  autoPhi: number;
  scale: number;
  offset: [number, number];
  dragRotation: GlobeRotation;
  rotation: GlobeRotation;
  pointer: GlobePointerState | null;
  resetFrameId: number | null;
  renderFrameId: number | null;
  unsubscribeThemeTransition: (() => void) | null;
  globeRootElement: HTMLDivElement | null;
  globe: Globe | null;
}

const createDefaultGlobeRefs = (globeConfig: GlobeConfig, viewState: GlobeViewState): GlobeRefs => ({
  config: globeConfig,
  autoPhi: 0,
  scale: viewState.scale,
  offset: viewState.offset,
  dragRotation: { phi: viewState.phi, theta: viewState.theta },
  rotation: {
    phi: viewState.phi,
    theta: clampTheta(viewState.theta, viewState.scale, globeConfig),
  },
  pointer: null,
  resetFrameId: null,
  renderFrameId: null,
  unsubscribeThemeTransition: null,
  globeRootElement: null,
  globe: null,
});

const createDefaultState = (globeConfig: GlobeConfig) => {
  const viewState = getInitialGlobeViewState(globeConfig);

  return {
    joinedUsersSince: new Date().toISOString(),
    joinNotifications: [] as Array<GlobeJoinNotification>,
    buckets: [] as Array<GlobeUserBucket>,
    isUserPanelOpen: false,
    openBucketId: null as string | null,
    selectedMarkerUserId: null as string | null,
    autoRotate: viewState.autoRotate ?? DEFAULT_GLOBE_AUTO_ROTATE,
    locked: viewState.locked ?? DEFAULT_GLOBE_LOCKED,
    isDragging: false,
    refs: ref(createDefaultGlobeRefs(globeConfig, viewState)),
  };
};

const createGlobeState = (globeConfig: GlobeConfig) => proxy(createDefaultState(globeConfig));

type GlobeState = ReturnType<typeof createGlobeState>;

const createGlobeRefs = (state: GlobeState) => ({
  globeRootRef: {
    get current() {
      return state.refs.globeRootElement;
    },
    setCurrent: (element: HTMLDivElement | null) => {
      state.refs.globeRootElement = element;
    },
  },
  globeRef: {
    get current() {
      return state.refs.globe;
    },
    set current(globe: Globe | null) {
      state.refs.globe = globe;
    },
  },
  scaleRef: {
    get current() {
      return state.refs.scale;
    },
    set current(scale: number) {
      state.refs.scale = scale;
    },
  },
  offsetRef: {
    get current() {
      return state.refs.offset;
    },
    set current(offset: [number, number]) {
      state.refs.offset = offset;
    },
  },
  rotationRef: {
    get current() {
      return state.refs.rotation;
    },
    set current(rotation: GlobeRotation) {
      state.refs.rotation = rotation;
    },
  },
});

const createGlobeActions = (state: GlobeState) => {
  const actions = {
    updateGlobeTheme: (globeThemeOptions: GlobeThemeOptions) => {
      state.refs.globe?.update({
        ...globeThemeOptions,
        offset: state.refs.offset,
        ...state.refs.rotation,
      });
    },
    setBuckets: (buckets: Array<GlobeUserBucket>) => {
      state.buckets = buckets;
    },
    setUserPanelOpen: (isOpen: boolean) => {
      state.isUserPanelOpen = isOpen;
    },
    setSelectedMarkerUserId: (userId: string | null) => {
      state.selectedMarkerUserId = userId;
    },
    changeOpenMarker: (bucketId: string, open: boolean) => {
      state.selectedMarkerUserId = null;
      state.openBucketId = open ? bucketId : null;
    },
    saveGlobeViewState: () => {
      globeViewState.set({
        scale: state.refs.scale,
        offset: state.refs.offset,
        phi: state.refs.rotation.phi,
        theta: state.refs.rotation.theta,
        autoRotate: state.autoRotate,
        locked: state.locked,
      });
    },
    cancelResetAnimation: () => {
      const resetFrameId = state.refs.resetFrameId;
      if (resetFrameId === null) return;

      cancelAnimationFrame(resetFrameId);
      state.refs.resetFrameId = null;
    },
    updateGlobeView: (scale: number, offset: [number, number]) => {
      const refs = state.refs;

      refs.scale = scale;
      refs.offset = offset;

      if (state.refs.globeRootElement) {
        setMarkerScale(state.refs.globeRootElement, scale, refs.config);
      }

      state.refs.globe?.update({ scale, offset, ...refs.rotation });
    },
    resetGlobeZoom: () => {
      const refs = state.refs;
      const globeConfig = refs.config;
      const startScale = refs.scale;
      const startOffset = refs.offset;
      const startedAt = performance.now();

      actions.cancelResetAnimation();

      const animateReset = (now: number) => {
        const progress = easeOutCubic(clampNumber((now - startedAt) / GLOBE_RESET_DURATION, 0, 1));
        const nextScale = startScale + (globeConfig.defaultScale - startScale) * progress;
        const nextOffset: [number, number] = [
          startOffset[0] + (0 - startOffset[0]) * progress,
          startOffset[1] + (0 - startOffset[1]) * progress,
        ];

        actions.updateGlobeView(nextScale, nextOffset);

        if (progress < 1) {
          refs.resetFrameId = requestAnimationFrame(animateReset);
          return;
        }

        refs.resetFrameId = null;
        actions.updateGlobeView(globeConfig.defaultScale, [0, 0]);
      };

      refs.resetFrameId = requestAnimationFrame(animateReset);
    },
    setAutoRotate: (autoRotate: boolean) => {
      state.autoRotate = autoRotate;
    },
    toggleAutoRotate: () => {
      state.autoRotate = !state.autoRotate;
    },
    toggleLocked: () => {
      state.locked = !state.locked;
    },
    setRotationAndOffset: (rotation: GlobeRotation, offset: [number, number]) => {
      const refs = state.refs;

      refs.dragRotation = rotation;
      refs.rotation = rotation;
      refs.offset = offset;
    },
    focusGlobeLocation: (location: [number, number]) => {
      const refs = state.refs;
      const globeConfig = refs.config;

      actions.cancelResetAnimation();

      if (state.autoRotate) {
        state.autoRotate = false;
      }

      const startRotation = {
        phi: refs.rotation.phi,
        theta: clampTheta(refs.rotation.theta, refs.scale, globeConfig),
      };
      const targetRotation = getFocusedRotation(startRotation, getLocationRotation(location, refs.scale, globeConfig));
      const startOffset = refs.offset;
      const startedAt = performance.now();

      refs.autoPhi = 0;

      const animateFocus = (now: number) => {
        const progress = easeOutCubic(clampNumber((now - startedAt) / GLOBE_RESET_DURATION, 0, 1));

        actions.setRotationAndOffset(
          interpolateRotation(startRotation, targetRotation, progress),
          interpolateOffset(startOffset, [0, 0], progress),
        );

        if (progress < 1) {
          refs.resetFrameId = requestAnimationFrame(animateFocus);
          return;
        }

        refs.resetFrameId = null;
        actions.setRotationAndOffset(targetRotation, [0, 0]);
      };

      refs.resetFrameId = requestAnimationFrame(animateFocus);
    },
    beginDrag: (clientX: number, clientY: number) => {
      if (state.locked) return false;

      const refs = state.refs;
      const globeConfig = refs.config;

      actions.cancelResetAnimation();
      if (state.autoRotate) {
        state.autoRotate = false;
      }

      state.isDragging = true;
      refs.pointer = {
        x: clientX,
        y: clientY,
        phi: refs.dragRotation.phi,
        theta: clampTheta(refs.dragRotation.theta, refs.scale, globeConfig),
      };

      return undefined;
    },
    drag: (clientX: number, clientY: number) => {
      const refs = state.refs;
      const pointer = refs.pointer;
      if (pointer === null) return;

      const deltaX = clientX - pointer.x;
      const deltaY = clientY - pointer.y;
      const dragSensitivity = getDragSensitivity(refs.scale, refs.config);

      refs.dragRotation = {
        phi: pointer.phi + deltaX / dragSensitivity,
        theta: clampTheta(pointer.theta + deltaY / dragSensitivity, refs.scale, refs.config),
      };
    },
    endDrag: () => {
      state.isDragging = false;
      state.refs.pointer = null;
    },
    zoomGlobe: (target: HTMLDivElement, clientX: number, clientY: number, deltaY: number) => {
      if (state.locked) return;

      const refs = state.refs;
      const globeConfig = refs.config;

      actions.cancelResetAnimation();

      const rect = target.getBoundingClientRect();
      const currentScale = refs.scale;
      const nextScale = clampNumber(
        currentScale - deltaY * GLOBE_ZOOM_SPEED,
        globeConfig.minScale,
        globeConfig.maxScale,
      );

      if (nextScale <= globeConfig.offsetResetScale) {
        refs.offset = [0, 0];
      } else {
        const cursorX = clientX - rect.left - rect.width / 2;
        const cursorY = clientY - rect.top - rect.height / 2;
        const scaleRatio = nextScale / currentScale;
        const nextOffset: [number, number] = [
          cursorX - (cursorX - refs.offset[0]) * scaleRatio,
          cursorY - (cursorY - refs.offset[1]) * scaleRatio,
        ];

        if (nextScale > currentScale) {
          const cursorFocusOffset = getCursorFocusOffset(rect, cursorX, cursorY, nextScale, globeConfig);
          const cursorPull = getZoomCursorPull(currentScale, nextScale, globeConfig);
          nextOffset[0] += (cursorFocusOffset[0] - nextOffset[0]) * cursorPull;
          nextOffset[1] += (cursorFocusOffset[1] - nextOffset[1]) * cursorPull;
        }

        refs.offset = clampGlobeOffset(nextOffset, rect, nextScale, globeConfig);
      }

      if (nextScale !== currentScale) {
        const preferredTheta = getPreferredTheta(nextScale, globeConfig);
        const thetaPull = nextScale > currentScale ? ZOOM_IN_THETA_PULL : ZOOM_OUT_THETA_PULL;
        refs.dragRotation = {
          ...refs.dragRotation,
          theta: clampTheta(
            refs.dragRotation.theta + (preferredTheta - refs.dragRotation.theta) * thetaPull,
            nextScale,
            globeConfig,
          ),
        };
      }

      actions.updateGlobeView(nextScale, refs.offset);
    },
    handleWheel: (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest(GLOBE_WHEEL_IGNORE_SELECTOR)) {
        return;
      }

      const globeRoot = state.refs.globeRootElement;
      if (!globeRoot) return;

      event.preventDefault();
      event.stopPropagation();
      actions.zoomGlobe(globeRoot, event.clientX, event.clientY, event.deltaY);
    },
    clampGlobeOffsetToRoot: () => {
      const globeRoot = state.refs.globeRootElement;
      if (!globeRoot) return;

      const refs = state.refs;

      refs.offset = clampGlobeOffset(refs.offset, globeRoot.getBoundingClientRect(), refs.scale, refs.config);
    },
    syncMarkerScale: () => {
      const globeRoot = state.refs.globeRootElement;
      if (!globeRoot) return;

      setMarkerScale(globeRoot, state.refs.scale, state.refs.config);
    },
    updateGlobeSize: (width: number, height: number) => {
      state.refs.globe?.update({
        width,
        height,
        offset: state.refs.offset,
        ...state.refs.rotation,
      });
    },
    startAnimation: () => {
      const refs = state.refs;
      let isRotationPaused = getThemeTransitioning();

      if (refs.renderFrameId !== null) {
        cancelAnimationFrame(refs.renderFrameId);
      }

      refs.unsubscribeThemeTransition?.();
      refs.unsubscribeThemeTransition = subscribeThemeTransition((isTransitioning) => {
        const frozenDragPhi = refs.rotation.phi - refs.autoPhi;
        const frozenDragTheta = clampTheta(refs.rotation.theta, refs.scale, refs.config);

        refs.dragRotation = { phi: frozenDragPhi, theta: frozenDragTheta };

        if (!isTransitioning) {
          refs.autoPhi = refs.rotation.phi - frozenDragPhi;
        }

        isRotationPaused = isTransitioning;
      });

      const animate = () => {
        if (!isRotationPaused && state.autoRotate) {
          refs.autoPhi += ROTATION_SPEED;
        }

        refs.rotation = {
          phi: refs.autoPhi + refs.dragRotation.phi,
          theta: clampTheta(refs.dragRotation.theta, refs.scale, refs.config),
        };
        state.refs.globe?.update({ ...refs.rotation, scale: refs.scale, offset: refs.offset });
        refs.renderFrameId = requestAnimationFrame(animate);
      };

      animate();
    },
    stopAnimation: () => {
      const refs = state.refs;

      if (refs.renderFrameId !== null) {
        cancelAnimationFrame(refs.renderFrameId);
        refs.renderFrameId = null;
      }
      actions.cancelResetAnimation();
      refs.unsubscribeThemeTransition?.();
      refs.unsubscribeThemeTransition = null;
    },
    openPanelUserOnGlobe: (user: GlobePanelUser | GlobeJoinedUser) => {
      const h3BucketId = user.h3BucketId;
      const bucket = h3BucketId
        ? state.buckets.find((candidate) => candidate.bucketIds.includes(h3BucketId))
        : undefined;

      if (!bucket) {
        toaster.create({
          id: 'globe-no-location',
          title: 'No location data',
          description: 'This user cannot be shown on the globe because no location is available for this time range.',
          type: 'info',
        });
        return;
      }

      actions.focusGlobeLocation(bucket.location);
      state.isUserPanelOpen = false;
      state.openBucketId = bucket.id;
      state.selectedMarkerUserId = user.id;
    },
    resetJoinedUsers: () => {
      state.joinNotifications.forEach((notification) => {
        window.clearTimeout(notification.dismissTimerId);
      });
      state.joinNotifications = [];
      state.joinedUsersSince = new Date().toISOString();
    },
    setJoinedUsersSince: (since: string) => {
      state.joinedUsersSince = since;
    },
    dismissNotification: (id: string) => {
      const notification = state.joinNotifications.find((candidate) => candidate.id === id);
      if (notification) {
        window.clearTimeout(notification.dismissTimerId);
      }

      state.joinNotifications = state.joinNotifications.filter((notification) => notification.id !== id);
    },
    addNotifications: (newUsers: Array<GlobeJoinedUser>) => {
      const notifications = snapshot(state).joinNotifications;
      const existingUserIds = new Set(notifications.map((notification) => notification.user.id));
      const createdAt = Date.now();

      const incomingNotifications = newUsers
        .map((user) => {
          const id = `${user.id}:${createdAt}`;

          return {
            id,
            createdAt,
            user,
            dismissTimerId: window.setTimeout(() => {
              actions.dismissNotification(id);
            }, NOTIFICATION_DURATION),
          };
        })
        .filter((notification) => !existingUserIds.has(notification.user.id));

      state.joinNotifications = [...notifications, ...incomingNotifications];
    },
    dispose: () => {
      state.joinNotifications.forEach((notification) => {
        window.clearTimeout(notification.dismissTimerId);
      });
      state.joinNotifications = [];
      actions.stopAnimation();
      actions.cancelResetAnimation();
      state.refs.globe = null;
      state.refs.globeRootElement = null;
    },
  };

  return actions;
};

const createGlobeStore = (globeConfig: GlobeConfig) => {
  const state = createGlobeState(globeConfig);

  return {
    store: state,
    actions: createGlobeActions(state),
    refs: createGlobeRefs(state),
  };
};

type GlobeStore = ReturnType<typeof createGlobeStore>;

const GlobeStoreContext = createContext<GlobeStore | null>(null);

interface GlobeStoreProviderProps {
  children: ReactNode;
  globeConfig: GlobeConfig;
}

export const GlobeStoreProvider = ({ children, globeConfig }: GlobeStoreProviderProps) => {
  const [store] = useState<GlobeStore>(() => createGlobeStore(globeConfig));

  useEffect(() => {
    return () => {
      store.actions.dispose();
    };
  }, [store]);

  return <GlobeStoreContext.Provider value={store}>{children}</GlobeStoreContext.Provider>;
};

export const useGlobeStore = () => {
  const context = useContext(GlobeStoreContext);

  if (!context) {
    throw new Error('useGlobeStore must be used within GlobeStoreProvider');
  }

  return context;
};
