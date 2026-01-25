import { useBreakpointValue } from '@chakra-ui/react';
import { initializePaddle } from '@paddle/paddle-js';
import { createRootRoute, HeadContent, Outlet, Scripts, useLocation, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { VemetricScript, vemetric } from '@vemetric/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { CrispChat } from '@/components/crisp-chat';
import { CrispScript } from '@/components/crisp-script';
import { ClientProviders } from '@/components/client-providers';
import { Provider } from '@/components/ui/provider';
import { Toaster } from '@/components/ui/toaster';
import { useColorMode } from '@/components/ui/color-mode';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { getHubUrl } from '@/utils/url';

let isCheckoutCompleted = false;
if (typeof window !== 'undefined') {
  const paddleToken = import.meta.env.VITE_PADDLE_TOKEN;
  if (paddleToken) {
    initializePaddle({
      environment: (import.meta.env.VITE_PADDLE_ENV as 'sandbox' | 'production') || 'sandbox',
      token: paddleToken,
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
  }
}

// Global search params available on all routes
const rootSearchSchema = z.object({
  orgSettings: z.enum(['general', 'billing', 'members']).optional(),
  pricingDialog: z.boolean().optional(),
  settings: z.enum(['general', 'auth']).optional(),
  changeEmail: z.boolean().optional(),
  error: z.string().optional(),
});

const vemetricToken = import.meta.env.VITE_VEMETRIC_TOKEN || import.meta.env.VEMETRIC_TOKEN || '';

export const Route = createRootRoute({
  validateSearch: zodValidator(rootSearchSchema),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <RootDocument>
      <Provider>
        <ClientProviders>
          <RootLayoutInner />
        </ClientProviders>
      </Provider>
    </RootDocument>
  );
}

function RootLayoutInner() {
  const location = useLocation();
  const { colorMode } = useColorMode();
  const { changeEmail, error: errorCode } = Route.useSearch();
  const navigate = useNavigate();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const identifiedUserIdRef = useRef<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Handle Vemetric user identification
  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    if (session !== null && session.user.id !== identifiedUserIdRef.current) {
      identifiedUserIdRef.current = session.user.id;
      vemetric.identify({
        identifier: session.user.id,
        displayName: session.user.name,
        avatarUrl: session.user.image ?? undefined,
      });
    } else if (session === null && identifiedUserIdRef.current !== null) {
      identifiedUserIdRef.current = null;
      vemetric.resetUser();
    }
  }, [isSessionLoading, session, session?.user?.id, session?.user?.name, session?.user?.image]);

  useEffect(() => {
    if (changeEmail) {
      setTimeout(() => {
        toaster.create({
          title: 'Email changed',
          description: 'Your email address has been changed successfully.',
          type: 'success',
          duration: 5000,
        });
      });
      navigate({
        to: location.pathname,
        search: (prev) => ({ ...prev, changeEmail: undefined }),
        replace: true,
      });
    }
  }, [changeEmail, location.pathname, navigate]);

  useEffect(() => {
    if (errorCode) {
      const accountAlreadyLinkedError = errorCode === 'account already linked to different user';
      const openSettings = accountAlreadyLinkedError;

      setTimeout(() => {
        const title = 'An error occured';
        let description = `Please reach out if the issue persists. (${errorCode})`;
        if (accountAlreadyLinkedError) {
          description = 'This account is already linked to a different user.';
        }

        toaster.create({
          title,
          description,
          type: 'error',
          duration: 5000,
        });
      });
      navigate({
        to: location.pathname,
        search: (prev) => ({ ...prev, error: undefined, settings: openSettings ? 'auth' : undefined }),
        replace: true,
      });
    }
  }, [errorCode, location.pathname, navigate]);

  return (
    <>
      <Outlet />
      {isMounted && (
        <VemetricScript
          host={getHubUrl()}
          token={vemetricToken}
          maskPaths={[
            '/p/*',
            '/p/*/users',
            '/p/*/users/*',
            '/p/*/user/*',
            '/p/*/settings',
            '/p/*/funnels',
            '/p/*/funnels/*',
            '/p/*/events',
            '/o/*',
            '/invite/*',
          ]}
        />
      )}
      <Toaster />
      {isMounted && <CrispScript />}
      {isMounted && !location.pathname.startsWith('/public/') && <CrispChat />}
    </>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
