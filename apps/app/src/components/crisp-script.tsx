import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { crispChatStore } from '@/stores/crisp-chat-store';
import { authClient } from '@/utils/auth';
import { HelmetScript } from './helmet-script';

export const CrispScript = () => {
  const renderScript = useSnapshot(crispChatStore).renderScript;
  const { data: session, isPending: isSessionLoading } = authClient.useSession();

  useEffect(() => {
    if (!renderScript) {
      return;
    }
    window.$crisp = window.$crisp ?? [];
    window.CRISP_WEBSITE_ID = '74ea904f-1cf5-4c05-a355-e6ab2ae12525';
  }, [renderScript]);

  useEffect(() => {
    if (isSessionLoading || !session?.user?.email) {
      return;
    }

    window.$crisp?.push(['set', 'user:email', session.user.email]);
  }, [session?.user?.email, isSessionLoading]);

  return (
    <>
      {renderScript && (
        <HelmetScript
          defer
          src="https://client.crisp.chat/l.js"
          onLoad={() => {
            if (session?.user?.email) {
              window.$crisp.push(['set', 'user:email', session.user.email]);
            }
          }}
        />
      )}
    </>
  );
};
