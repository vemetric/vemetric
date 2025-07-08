import { useBreakpointValue } from '@chakra-ui/react';
import { initializePaddle } from '@paddle/paddle-js';
import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { CrispChat } from '@/components/crisp-chat';
import { CrispScript } from '@/components/crisp-script';
import { Redirects } from '@/components/redirects';
import { useColorMode } from '@/components/ui/color-mode';

let isCheckoutCompleted = false;
initializePaddle({
  environment: (import.meta.env.VITE_PADDLE_ENV as 'sandbox' | 'production') || 'sandbox',
  token: import.meta.env.VITE_PADDLE_TOKEN,
  eventCallback: (data) => {
    if (data.name === 'checkout.completed') {
      isCheckoutCompleted = true;
    } else if (data.name === 'checkout.closed') {
      if (isCheckoutCompleted) {
        window.location.reload();
      }
    }
  },
});

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { location } = useRouterState();
  const { colorMode } = useColorMode();
  const isMobile = useBreakpointValue({ base: true, md: false });

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (isMobile) {
        meta.setAttribute('content', colorMode === 'dark' ? '#27272a' : '#ffffff');
      } else {
        meta.setAttribute('content', colorMode === 'dark' ? '#18181b' : '#f4f4f5');
      }
    }
  }, [colorMode, isMobile]);

  return (
    <Redirects>
      <Outlet />
      <CrispScript />
      {!location.pathname.startsWith('/public/') && <CrispChat />}
    </Redirects>
  );
}
