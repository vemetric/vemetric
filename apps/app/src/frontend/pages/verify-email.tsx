import { Box, Button, Card, Container, Flex, Heading, Link, PinInput, Stack, Text } from '@chakra-ui/react';
import { createFileRoute, Link as RouterLink, redirect, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { useState } from 'react';
import { TbMailCheck } from 'react-icons/tb';
import { z } from 'zod';
import { Logo } from '@/components/logo';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { requireAnonymous } from '@/utils/auth-guards';
import { redirectPath } from '@/utils/local-storage';
import { getAppUrl, getLandingPageUrl } from '@/utils/url';

const searchSchema = z.object({
  email: z.string().email().catch(''),
});

export const Route = createFileRoute('/verify-email')({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ search }) => {
    await requireAnonymous();
    if (!search.email) {
      throw redirect({ to: '/login', replace: true });
    }
  },
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email: emailSearch } = Route.useSearch();
  const navigate = useNavigate();
  const [otp, setOtp] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const verifyEmail = async (otpValue: string) => {
    const trimmedEmail = emailSearch.trim();
    if (otpValue.length !== 6) {
      toaster.create({
        title: 'Please enter the 6-digit code',
        type: 'error',
      });
      return;
    }

    setIsVerifying(true);
    const result = await authClient.emailOtp.verifyEmail({
      email: trimmedEmail,
      otp: otpValue,
    });
    setIsVerifying(false);

    if (result.error) {
      toaster.create({
        title: result.error.message,
        type: 'error',
      });
      return;
    }

    const redirect = redirectPath.get();
    if (redirect) {
      redirectPath.clear();
      navigate({ to: redirect });
      return;
    }

    navigate({ to: '/' });
  };

  const sendCode = async () => {
    const trimmedEmail = emailSearch.trim();

    setIsSendingCode(true);
    const result = await authClient.sendVerificationEmail({
      email: trimmedEmail,
      callbackURL: getAppUrl() + '/',
    });
    setIsSendingCode(false);

    if (result.error) {
      toaster.create({
        title: result.error.message,
        type: 'error',
      });
      return;
    }

    toaster.create({
      title: 'Verification email sent',
      description: 'Check your inbox for the latest verification code.',
      type: 'success',
    });
  };

  return (
    <Flex minH="100dvh" align="center" justify="center">
      <Container maxW="md">
        <Stack gap={6} align="center">
          <Link href={getLandingPageUrl()}>
            <Logo asLink={false} h="50px" />
          </Link>

          <Card.Root w="full">
            <Card.Body>
              <Stack gap={6} align="center" textAlign="center" pt={3}>
                <Box p={4} bg="purple.subtle" borderRadius="full">
                  <TbMailCheck size={32} />
                </Box>

                <Stack gap={3} w="full">
                  <Heading size="lg">Verify your email</Heading>
                  <Text color="fg.muted">Enter the 6-digit code we sent to your inbox to activate your account.</Text>
                  <Text color="fg.muted" fontSize="sm">
                    Code sent to <strong>{emailSearch}</strong>
                  </Text>
                </Stack>

                <Stack gap={5} w="full">
                  <PinInput.Root
                    size={{ base: 'lg', md: 'xl' }}
                    mx="auto"
                    variant="subtle"
                    type="numeric"
                    otp
                    count={6}
                    value={otp}
                    onValueChange={(details) => setOtp(details.value)}
                  >
                    <PinInput.HiddenInput />
                    <PinInput.Control>
                      <PinInput.Input index={0} />
                      <PinInput.Input index={1} />
                      <PinInput.Input index={2} />
                      <PinInput.Input index={3} />
                      <PinInput.Input index={4} />
                      <PinInput.Input index={5} />
                    </PinInput.Control>
                  </PinInput.Root>

                  <Stack gap={3} w="full">
                    <Button
                      colorPalette="purple"
                      size="lg"
                      loading={isVerifying}
                      onClick={() => {
                        void verifyEmail(otp.join(''));
                      }}
                    >
                      Verify email
                    </Button>

                    <Button variant="surface" loading={isSendingCode} onClick={() => void sendCode()}>
                      Resend verification email
                    </Button>
                  </Stack>

                  <Text fontSize="sm" color="fg.muted">
                    Already verified?{' '}
                    <Link asChild variant="underline">
                      <RouterLink to="/login">Sign in</RouterLink>
                    </Link>
                  </Text>
                </Stack>
              </Stack>
            </Card.Body>
          </Card.Root>
        </Stack>
      </Container>
    </Flex>
  );
}
