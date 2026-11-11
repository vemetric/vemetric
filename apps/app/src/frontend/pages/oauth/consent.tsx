import { Box, Button, Card, Container, Flex, Heading, Image, Link, Spinner, Stack, Text } from '@chakra-ui/react';
import { createFileRoute, Link as RouterLink } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { TbArrowBackUp, TbEye, TbFolderPlus, TbPlugConnected, TbWorld } from 'react-icons/tb';
import { Logo } from '@/components/logo';
import { OauthAccessChoice, useOauthAccessChoice } from '@/components/oauth-access-choice';
import { SignedInAs } from '@/components/signed-in-as';
import { ErrorState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { requireAuthentication } from '@/utils/auth-guards';
import { clearPendingOauthAuthorize, getSignedOauthQuery } from '@/utils/oauth-flow';
import { trpc, type OauthConsentInfo } from '@/utils/trpc';
import { getLandingPageUrl } from '@/utils/url';

export const Route = createFileRoute('/oauth/consent')({
  beforeLoad: () => requireAuthentication(),
  component: ConsentPage,
});

type ConsentInfo = OauthConsentInfo;

async function sendConsent(accept: boolean, oauthQuery: string) {
  const { data, error } = await authClient.$fetch<{ redirect?: boolean; url?: string }>('/oauth2/consent', {
    method: 'POST',
    body: { accept, oauth_query: oauthQuery },
  });
  if (error || !data?.url) {
    throw new Error(error?.message || 'The authorization failed. Please connect again from your app.');
  }
  window.location.href = data.url;
}

function ConsentPage() {
  const oauthQuery = useMemo(() => getSignedOauthQuery(), []);
  const { data: session } = authClient.useSession();
  const {
    data: info,
    error,
    isLoading,
  } = trpc.oauth.consentInfo.useQuery(
    { oauthQuery: oauthQuery ?? '' },
    { enabled: !!oauthQuery, retry: false, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    // The flow arrived here, so there's nothing to resume after a login anymore.
    clearPendingOauthAuthorize();
  }, []);

  if (!oauthQuery || error) {
    return (
      <PageFrame>
        <ErrorState
          title="This connection request is invalid or has expired"
          description={error?.message ?? 'Please connect again from your app.'}
        />
      </PageFrame>
    );
  }

  if (isLoading || !info) {
    return (
      <Flex minH="100dvh" align="center" justify="center">
        <Spinner size="lg" />
      </Flex>
    );
  }

  return (
    <PageFrame>
      <ConsentForm info={info} oauthQuery={oauthQuery} />
      {session?.user && <SignedInAs user={session.user} mt={5} />}
    </PageFrame>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <Flex minH="100dvh" align="center" justify="center" p={4}>
      <Container maxW="lg" px={0}>
        <Stack gap={6} align="center">
          <Link href={getLandingPageUrl()}>
            <Logo asLink={false} h="50px" />
          </Link>
          <Card.Root w="full">
            <Card.Body>{children}</Card.Body>
          </Card.Root>
        </Stack>
      </Container>
    </Flex>
  );
}

function ConsentForm({ info, oauthQuery }: { info: ConsentInfo; oauthQuery: string }) {
  const accessChoice = useOauthAccessChoice(info.organizations, info.currentAccess);
  const { access, sharesNothing } = accessChoice;
  const [pendingAction, setPendingAction] = useState<'allow' | 'deny' | null>(null);
  const { client } = info;

  const { mutateAsync: saveAccess } = trpc.oauth.saveAccess.useMutation();

  const onAllow = async () => {
    setPendingAction('allow');
    try {
      await saveAccess({ oauthQuery, access });
      await sendConsent(true, oauthQuery);
    } catch (err) {
      setPendingAction(null);
      toaster.create({ title: 'Error', description: (err as Error).message, type: 'error' });
    }
  };

  const onDeny = async () => {
    setPendingAction('deny');
    try {
      await sendConsent(false, oauthQuery);
    } catch (err) {
      setPendingAction(null);
      toaster.create({ title: 'Error', description: (err as Error).message, type: 'error' });
    }
  };

  // Without any project there's nothing to share, so the page only says what to do instead.
  if (!info.organizations.some(({ projects }) => projects.length > 0)) {
    return (
      <Stack gap={6} pt={2} align="center" textAlign="center">
        <Box p={4} bg="purple.subtle" color="purple.fg" borderRadius="full">
          <TbFolderPlus size={28} />
        </Box>
        <Stack gap={2}>
          <Heading size="lg">Create a project first</Heading>
          <Text color="fg.muted">
            <strong>{client.name}</strong> wants to access your analytics data, but you don&apos;t have a project in
            Vemetric yet.
          </Text>
          <Text color="fg.muted">Create your first project, then connect {client.name} again.</Text>
        </Stack>
        <Stack gap={3} w="full">
          <Button colorPalette="purple" size="lg" asChild disabled={!!pendingAction}>
            <RouterLink to="/">Create a project</RouterLink>
          </Button>
          <Button variant="surface" onClick={onDeny} loading={pendingAction === 'deny'}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap={6} pt={2}>
      <Stack gap={4} align="center" textAlign="center">
        {client.icon ? (
          <Image src={client.icon} alt="" boxSize="56px" rounded="lg" />
        ) : (
          <Box p={4} bg="purple.subtle" color="purple.fg" borderRadius="full">
            <TbPlugConnected size={28} />
          </Box>
        )}
        <Stack gap={2}>
          <Heading size="lg">Connect {client.name} to Vemetric</Heading>
          <Text color="fg.muted">
            <strong>{client.name}</strong> wants to access your analytics data.
          </Text>
        </Stack>
      </Stack>

      <Stack gap={2} fontSize="sm" color="fg.muted" borderWidth="1px" rounded="md" p={3}>
        <Flex gap={2} align="center">
          <TbEye />
          <Text>Read-only: it can query your analytics, but not change anything.</Text>
        </Flex>
        {client.redirectTo && (
          <Flex gap={2} align="center">
            <TbArrowBackUp />
            <Text>
              After allowing it, you&apos;ll return to <strong>{client.redirectTo}</strong>.
            </Text>
          </Flex>
        )}
        {(client.metadataHost || client.uri) && (
          <Flex gap={2} align="center">
            <TbWorld />
            <Text>
              {client.metadataHost ? (
                <>
                  Registered by <strong>{client.metadataHost}</strong>
                </>
              ) : (
                <Link href={client.uri ?? undefined} target="_blank" rel="noopener noreferrer" variant="underline">
                  {client.uri}
                </Link>
              )}
            </Text>
          </Flex>
        )}
      </Stack>

      <OauthAccessChoice state={accessChoice} disabled={pendingAction !== null} />

      <Stack gap={3}>
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          Only allow apps you trust. You can change or remove the access anytime in your account settings under
          Connected apps.
        </Text>
        {/* Like the team invitation page: the main action on top, the alternative below. */}
        <Stack gap={3}>
          <Button
            colorPalette="purple"
            size="lg"
            onClick={onAllow}
            loading={pendingAction === 'allow'}
            disabled={!!pendingAction || sharesNothing}
          >
            Allow access
          </Button>
          <Button variant="surface" onClick={onDeny} loading={pendingAction === 'deny'} disabled={!!pendingAction}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
