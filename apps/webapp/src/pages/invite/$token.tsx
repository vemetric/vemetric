import { Box, Button, Card, Container, Flex, Heading, Spinner, Stack, Text, Link } from '@chakra-ui/react';
import { createFileRoute, Link as RouterLink, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { TbBuilding, TbCheck } from 'react-icons/tb';
import { Logo } from '@/components/logo';
import { ErrorState } from '@/components/ui/empty-state';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { redirectPath } from '@/utils/local-storage';
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

  const {
    data: invitation,
    error: invitationError,
    isLoading: isInvitationLoading,
  } = trpc.organization.getInvitationByToken.useQuery({ token });

  const { mutate: acceptInvitation } = trpc.organization.acceptInvitation.useMutation({
    onSuccess: async (data) => {
      toaster.create({
        title: `You've joined ${data.organizationName}`,
        type: 'success',
      });
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

  if (isSessionLoading || isInvitationLoading || isAccepting) {
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
              <Stack gap={6} align="center" textAlign="center" py={4}>
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
                        setIsAccepting(true);
                        acceptInvitation({ token });
                      }}
                    >
                      <TbCheck />
                      Accept Invitation
                    </Button>
                    <Button asChild variant="outline">
                      <RouterLink to="/">Go to Dashboard</RouterLink>
                    </Button>
                    <Text fontSize="sm" color="fg.muted">
                      Signed in as {session.user.email}
                    </Text>
                  </Stack>
                ) : (
                  <Stack gap={3} w="full">
                    <Button
                      asChild
                      colorPalette="purple"
                      size="lg"
                      onClick={() => redirectPath.set(`/invite/${token}`)}
                    >
                      <RouterLink to="/login">Sign in to Accept</RouterLink>
                    </Button>
                    <Text fontSize="sm" color="fg.muted">
                      Don&apos;t have an account?{' '}
                      <Link asChild variant="underline" onClick={() => redirectPath.set(`/invite/${token}`)}>
                        <RouterLink to="/signup">Sign up</RouterLink>
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
