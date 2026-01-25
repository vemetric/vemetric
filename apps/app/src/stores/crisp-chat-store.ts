import { proxy, useSnapshot } from 'valtio';

declare global {
  interface Window {
    $crisp: (string | string[])[][];
    CRISP_WEBSITE_ID: string;
    openCrispChat: (toggle?: boolean) => void;
  }
}

export const crispChatStore = proxy({ renderScript: false, isLoading: false });

export const useIsCrispChatLoading = () => {
  return useSnapshot(crispChatStore).isLoading;
};

export const useOpenCrispChat = () => {
  const renderScript = useSnapshot(crispChatStore).renderScript;

  return (toggle?: boolean) => {
    if (!window.$crisp) {
      crispChatStore.isLoading = true;
      return;
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
