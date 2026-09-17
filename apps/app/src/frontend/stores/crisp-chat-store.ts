import { proxy, useSnapshot } from 'valtio';
import { IS_SELF_HOSTED } from '@/utils/self-hosted';

declare global {
  interface Window {
    $crisp: (string | string[])[][];
    CRISP_WEBSITE_ID: string;
    openCrispChat: (toggle?: boolean) => void;
  }
}

export const crispChatStore = proxy({ renderScript: false, isLoading: false });

/** The support chat talks to Vemetric's own Crisp workspace, so it stays off when self hosted. */
export const isCrispChatEnabled = !IS_SELF_HOSTED;

export const useIsCrispChatLoading = () => {
  return useSnapshot(crispChatStore).isLoading;
};

export const useOpenCrispChat = () => {
  const renderScript = useSnapshot(crispChatStore).renderScript;

  return (toggle?: boolean) => {
    if (!isCrispChatEnabled) {
      return;
    }

    if (!window.$crisp) {
      crispChatStore.isLoading = true;
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = '74ea904f-1cf5-4c05-a355-e6ab2ae12525';
      window.$crisp.push([
        'on',
        'chat:opened',
        (() => {
          crispChatStore.isLoading = false;
        }) as any,
      ]);
    }

    if (toggle && (window.$crisp as any).is?.('chat:opened')) {
      window.$crisp.push(['do', 'chat:close']);
    } else {
      window.$crisp.push(['do', 'chat:open']);
    }

    if (!renderScript) {
      crispChatStore.renderScript = true;
    }
  };
};
