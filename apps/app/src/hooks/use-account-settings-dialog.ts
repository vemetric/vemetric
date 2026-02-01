import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { authClient } from '@/utils/auth';

export function useAccountSettingsDialog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPending, data: session } = authClient.useSession();

  // Get the typed search params from the root route
  const { settings: tab } = useSearch({ strict: false });
  type SettingsTab = typeof tab;

  const isOpen = tab !== undefined && !isPending && Boolean(session);

  const open = useCallback(
    (newTab: SettingsTab = 'general') => {
      navigate({
        to: location.pathname,
        search: (prev) => ({ ...prev, settings: newTab }),
      });
    },
    [location.pathname, navigate],
  );

  const close = useCallback(() => {
    navigate({
      to: location.pathname,
      search: (prev) => ({ ...prev, settings: undefined }),
    });
  }, [location.pathname, navigate]);

  const setTab = (newTab: SettingsTab) => {
    navigate({
      to: location.pathname,
      search: (prev) => ({ ...prev, settings: newTab }),
    });
  };

  return {
    isOpen,
    tab,
    open,
    close,
    setTab,
  };
}
