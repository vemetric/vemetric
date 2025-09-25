import { vemetric } from '@vemetric/react';
import { useEffect, useState } from 'react';
import { authClient } from '@/utils/auth';

export type AuthContext = ReturnType<typeof useAuth>;

let identifiedUserId: string | null = null;

export const useAuth = () => {
  const { data: session, isPending, refetch } = authClient.useSession();

  const [isSessionLoading, setIsSessionLoading] = useState(true);
  useEffect(() => {
    if (!isPending) {
      setIsSessionLoading(false);
    }
  }, [isPending]);

  const isLoggedIn = session !== null && session.user !== null;

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    if (isLoggedIn) {
      if (identifiedUserId === session?.user?.id) {
        return;
      }

      identifiedUserId = session.user.id;
      vemetric.identify({
        identifier: session.user.id,
        displayName: session.user.name,
      });
    } else {
      if (identifiedUserId === null) {
        return;
      }

      identifiedUserId = null;
      vemetric.resetUser();
    }
  }, [isSessionLoading, isLoggedIn, session?.user?.id, session?.user?.name]);

  if (isSessionLoading) {
    return { isSessionLoading, isLoggedIn: false, session: null, refetchAuth: refetch };
  }

  if (!isLoggedIn) {
    return { isLoggedIn, session: null, isSessionLoading, refetchAuth: refetch };
  }

  return {
    isLoggedIn,
    session,
    isSessionLoading,
    refetchAuth: refetch,
  };
};
