import { initializePaddle } from '@paddle/paddle-js';
import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { CrispChat } from '@/components/crisp-chat';
import { CrispScript } from '@/components/crisp-script';
import { Redirects } from '@/components/redirects';

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

  return (
    <Redirects>
      <Outlet />
      <CrispScript />
      {!location.pathname.startsWith('/public/') && <CrispChat />}
    </Redirects>
  );
}
