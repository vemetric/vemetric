import { useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { useAuth } from '@/hooks/use-auth';
import { crispChatStore } from '@/stores/crisp-chat-store';
import { HelmetScript } from './helmet-script';

export const CrispScript = () => {
  const renderScript = useSnapshot(crispChatStore).renderScript;
  const { isSessionLoading, session } = useAuth();

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
