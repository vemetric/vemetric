import { getRouteApi } from '@tanstack/react-router';
import { useEffect } from 'react';
import { getStoredActiveUsersVisible, setStoredActiveUsersVisible } from '@/utils/session-storage';

export type ActiveUsersRoute = '/_layout/p/$projectId/funnels/' | '/_layout/p/$projectId/funnels/$funnelId';

interface Props {
  from: ActiveUsersRoute;
}

export const useActiveUsersParam = ({ from }: Props) => {
  const route = getRouteApi(from);

  const navigate = route.useNavigate();
  const { u: _activeUsersVisible } = route.useSearch();
  const activeUsersVisible = _activeUsersVisible ?? getStoredActiveUsersVisible() ?? false;

  useEffect(() => {
    if (activeUsersVisible || undefined !== _activeUsersVisible) {
      navigate({
        search: (prev) => ({ ...prev, u: activeUsersVisible || undefined }),
        replace: true,
      });
    }

    setStoredActiveUsersVisible(activeUsersVisible);
  }, [activeUsersVisible, _activeUsersVisible, navigate]);

  const setActiveUsersVisible = (value: boolean) => {
    setStoredActiveUsersVisible(value);
    navigate({
      search: (prev) => ({ ...prev, u: value || undefined }),
      resetScroll: false,
    });
  };

  return { activeUsersVisible, setActiveUsersVisible };
};
