import { useBreakpointValue } from '@chakra-ui/react';
import { initializePaddle } from '@paddle/paddle-js';
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { vemetric } from '@vemetric/react';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { CrispChat } from '~/components/crisp-chat';
import { CrispScript } from '~/components/crisp-script';
import { useColorMode } from '~/components/ui/color-mode';
import { toaster } from '~/components/ui/toaster';
import { authClient } from '~/utils/auth';
import { DefaultCatchBoundary } from '~/components/error-boundary';
import { NotFound } from '~/components/not-found';
import { AppProviders } from '~/components/app-providers';
import 'simplebar-react/dist/simplebar.min.css';

let isCheckoutCompleted = false;

// Global search params available on all routes
const rootSearchSchema = z.object({
  orgSettings: z.enum(['general', 'billing', 'members']).optional(),
  pricingDialog: z.boolean().optional(),
  settings: z.enum(['general', 'auth']).optional(),
  changeEmail: z.boolean().optional(),
  error: z.string().optional(),
});

export const Route = createRootRoute({
  validateSearch: zodValidator(rootSearchSchema),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#ffffff' },
      { title: 'Vemetric' },
      { name: 'description', content: 'Open-source web and product analytics platform' },
      { property: 'og:title', content: 'Vemetric' },
      { property: 'og:description', content: 'Open-source web and product analytics platform' },
      { property: 'og:image', content: 'https://vemetric.com/images/og/default-1.jpg' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: 'https://vemetric.com/images/og/default-1.jpg' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png', sizes: '180x180' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  component: RootDocument,
  errorComponent: (props) => (
    <RootDocument>
      <DefaultCatchBoundary {...props} />
    </RootDocument>
  ),
  notFoundComponent: () => <NotFound />,
});

function RootDocument({ children }: { children?: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AppProviders>
          {children ?? <RootLayout />}
        </AppProviders>
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  const location = useLocation();
  const { colorMode } = useColorMode();
  const { changeEmail, error: errorCode } = Route.useSearch();
  const navigate = useNavigate();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const identifiedUserIdRef = useRef<string | null>(null);
  const paddleInitializedRef = useRef(false);

  // Initialize Paddle (only in browser)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (paddleInitializedRef.current) return;
    paddleInitializedRef.current = true;

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
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
      <CrispScript />
      {!location.pathname.startsWith('/public/') && <CrispChat />}
    </>
  );
}
