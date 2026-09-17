import { Box, Button, Card, Container, Flex, Heading, Spinner, Stack, Text, Link } from '@chakra-ui/react';
import { createFileRoute, Link as RouterLink, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { TbBuilding, TbCheck } from 'react-icons/tb';
import { Logo } from '@/components/logo';
import { ErrorState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { UserIdentity } from '@/components/user-identity';
import { authClient } from '@/utils/auth';
import {
  clearInvitationTokenCookie,
  getInvitationTokenCookie,
  setInvitationTokenCookie,
} from '@/utils/invitation-token';
import { redirectPath } from '@/utils/local-storage';
import { IS_SELF_HOSTED } from '@/utils/self-hosted';
import { trpc } from '@/utils/trpc';
import { getLandingPageUrl } from '@/utils/url';

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const { data: session, isPending: isSessionLoading, refetch } = authClient.useSession();
  const isLoggedIn = !!session?.user;
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Stored as soon as the visitor is known to be logged out, not only when one of the buttons
  // below is used: an OAuth signup creates the account in the provider callback, a request that
  // carries no query parameters, so the cookie is the only way the token reaches the backend.
  // Only self hosted instances need it, they are the ones that can have registration turned off.
  useEffect(() => {
    if (IS_SELF_HOSTED && !isSessionLoading && !isLoggedIn) {
      setInvitationTokenCookie(token);
    }
  }, [isSessionLoading, isLoggedIn, token]);

  const {
    data: invitation,
    error: invitationError,
    isLoading: isInvitationLoading,
  } = trpc.organization.getInvitationByToken.useQuery({ token });

  // An invited signup consumes the invitation while the account is created, so the token is
  // already gone by the time the provider callback sends the user back here. That is a completed
  // invitation, not a broken link: the cookie this browser still carries is what tells the two
  // apart, so the user is sent on to the dashboard instead of being shown an error.
  // Only self hosted instances consume a token during signup, so the hosted instance keeps
  // showing the invalid invitation state for a link that no longer resolves.
  const isConsumedInvitation =
    IS_SELF_HOSTED && isLoggedIn && invitation?.success === false && getInvitationTokenCookie() === token;

  useEffect(() => {
    if (!isConsumedInvitation) {
      return;
    }

    clearInvitationTokenCookie();
    setIsRedirecting(true);
    const organizationId = session?.organizations?.[0]?.id;
    if (organizationId) {
      navigate({ to: '/o/$organizationId', params: { organizationId: String(organizationId) } });
      return;
    }

    // The account exists and the invitation is used up, but the user belongs to no organization.
    // The join failed after the account was created, for example because the inviting
    // organization hit its member limit, so say so instead of dropping them on an empty
    // dashboard without explanation.
    toaster.create({
      title: 'Your account was created, but you were not added to the team',
      description: 'Please ask an admin of the organization for a new invitation.',
      type: 'warning',
    });
    navigate({ to: '/' });
  }, [isConsumedInvitation, navigate, session]);

  const { mutate: acceptInvitation } = trpc.organization.acceptInvitation.useMutation({
    onSuccess: async (data) => {
      // The token has been redeemed, the cookie that carried it through the signup is obsolete.
      if (IS_SELF_HOSTED) {
        clearInvitationTokenCookie();
      }
      toaster.create({
        title: `You've joined ${data.organizationName}`,
        type: 'success',
      });
      setIsRedirecting(true);
      // Refresh session to get updated organizations list
      await refetch();
      navigate({ to: '/o/$organizationId', params: { organizationId: data.organizationId } });
    },
    onError: (error) => {
      setIsAccepting(false);
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  if (isSessionLoading || isInvitationLoading || isRedirecting) {
    return (
      <Flex minH="100dvh" align="center" justify="center">
        <Spinner size="lg" />
      </Flex>
    );
  }

  if (!invitation || invitationError) {
    return (
      <Flex minH="100dvh" align="center" justify="center">
        <Container maxW="lg">
          <Card.Root>
            <Card.Body mx="auto">
              <ErrorState title="An error occured while loading the invitation" />
            </Card.Body>
          </Card.Root>
        </Container>
      </Flex>
    );
  }

  if (!invitation.success) {
    return (
      <Flex minH="100dvh" align="center" justify="center">
        <Container maxW="lg">
          <Card.Root>
            <Card.Body mx="auto">
              <ErrorState
                title="Invalid Invitation"
                description="This invitation link is invalid or has already been used."
              />
              <Flex justify="center" mt={4} mb={2}>
                <Button asChild>
                  <RouterLink to="/">Go to Dashboard</RouterLink>
                </Button>
              </Flex>
            </Card.Body>
          </Card.Root>
        </Container>
      </Flex>
    );
  }

  return (
    <Flex minH="100dvh" align="center" justify="center" p={4}>
      <Container maxW="md">
        <Stack gap={6} align="center">
          <Link href={getLandingPageUrl()}>
            <Logo asLink={false} h="50px" />
          </Link>

          <Card.Root w="full">
            <Card.Body>
              <Stack gap={6} align="center" textAlign="center" pt={3}>
                <Box p={4} bg="purple.subtle" borderRadius="full">
                  <TbBuilding size={32} />
                </Box>

                <Stack gap={3}>
                  <Heading size="lg">Join your team</Heading>
                  <Text color="fg.muted">
                    You&apos;ve been invited to join <strong>{invitation.organizationName}</strong>.
                  </Text>
                </Stack>

                {isLoggedIn ? (
                  <Stack gap={3} w="full">
                    <Button
                      colorPalette="purple"
                      size="lg"
                      loading={isAccepting}
                      onClick={() => {
                        acceptInvitation({ token });
                      }}
                    >
                      <TbCheck />
                      Accept Invitation
                    </Button>
                    <Button asChild variant="outline">
                      <RouterLink to="/">Go to Dashboard</RouterLink>
                    </Button>
                    <Flex align="center" gap={2} justify="center" flexWrap="wrap" mt={2} color="fg.muted">
                      <Text fontSize="sm" flexShrink="0">
                        Signed in as
                      </Text>
                      <UserIdentity
                        displayName={session.user.name || session.user.email || 'Unnamed'}
                        image={session.user.image}
                        avatarSize="2xs"
                      />
                    </Flex>
                  </Stack>
                ) : (
                  <Stack gap={3} w="full">
                    <Button
                      asChild
                      colorPalette="purple"
                      size="lg"
                      onClick={() => {
                        redirectPath.set(`/invite/${token}`);
                        if (IS_SELF_HOSTED) {
                          setInvitationTokenCookie(token);
                        }
                      }}
                    >
                      <RouterLink to="/login">Sign in to Accept</RouterLink>
                    </Button>
                    <Text fontSize="sm" color="fg.muted" mt={2}>
                      Don&apos;t have an account?{' '}
                      <Link
                        asChild
                        variant="underline"
                        onClick={() => {
                          redirectPath.set(`/invite/${token}`);
                          if (IS_SELF_HOSTED) {
                            setInvitationTokenCookie(token);
                          }
                        }}
                      >
                        <RouterLink to="/signup" search={IS_SELF_HOSTED ? { invitationToken: token } : {}}>
                          Sign up
                        </RouterLink>
                      </Link>
                    </Text>
                  </Stack>
                )}
              </Stack>
            </Card.Body>
          </Card.Root>
        </Stack>
      </Container>
    </Flex>
  );
}
