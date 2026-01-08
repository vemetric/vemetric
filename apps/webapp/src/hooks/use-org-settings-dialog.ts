import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useCurrentOrganization } from './use-current-organization';

/**
 * Hook to manage the organization settings dialog via URL search params.
 * The `orgSettings` param is defined on the root route, making it available everywhere.
 * The dialog can be opened from anywhere by adding ?orgSettings=general or ?orgSettings=members
 * Only admins can open the settings dialog.
 */
export function useOrgSettingsDialog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { organizationId, isAdmin, isOnboarded, currentOrganization } = useCurrentOrganization();

  // Get the typed search params from the root route
  const { orgSettings: tab } = useSearch({ strict: false });
  type SettingsTab = typeof tab;

  const isOpen = tab !== undefined;

  const open = useCallback(
    (newTab: SettingsTab = 'general', pricingDialog?: boolean) => {
      navigate({
        to: location.pathname,
        search: (prev) => ({ ...prev, orgSettings: newTab, pricingDialog }),
        replace: true,
      });
    },
    [location.pathname, navigate],
  );

  const close = useCallback(() => {
    navigate({
      to: location.pathname,
      search: (prev) => ({ ...prev, orgSettings: undefined }),
      replace: true,
    });
  }, [location.pathname, navigate]);

  const setTab = (newTab: SettingsTab) => {
    navigate({
      to: location.pathname,
      search: (prev) => ({ ...prev, orgSettings: newTab }),
      replace: true,
    });
  };

  return {
    isOpen,
    isAdmin,
    isOnboarded,
    tab,
    organizationId,
    currentOrganization,
    open,
    close,
    setTab,
  };
}
