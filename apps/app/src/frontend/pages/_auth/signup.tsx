import { Stack, Heading, Input, Button, Text, Link, Field, HStack, Separator } from '@chakra-ui/react';
import { createFileRoute, Link as RouterLink, useNavigate } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { useState } from 'react';
import { TbMail, TbLock, TbBrandGithub, TbBrandGoogleFilled } from 'react-icons/tb';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { authClient, loginWithProvider } from '@/utils/auth';
import { clearInvitationTokenCookie, parseInvitationSearch } from '@/utils/invitation-token';
import { IS_SELF_HOSTED } from '@/utils/self-hosted';
import { ENABLED_SOCIAL_PROVIDERS, isSocialProviderEnabled } from '@/utils/social-providers';
import { getAppUrl } from '@/utils/url';

export const Route = createFileRoute('/_auth/signup')({
  validateSearch: parseInvitationSearch,
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { invitationToken } = Route.useSearch();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const hasSocialProviders = ENABLED_SOCIAL_PROVIDERS.length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toaster.create({
        title: 'Password must be at least 8 characters long',
        description: 'Please check your password and try again',
        type: 'error',
      });
      return;
    }

    authClient.signUp.email(
      {
        email,
        password,
        name: '',
        // callback url for email verification
        callbackURL: getAppUrl() + '/',
      },
      {
        // The backend reads the token from the query string of this very request, which is what
        // lets an invited user sign up on an instance with registration turned off. The hosted
        // instance has registration open and never needs it, so its request stays untouched.
        query: IS_SELF_HOSTED && invitationToken ? { invitationToken } : undefined,
        onRequest: () => {
          setIsLoading(true);
        },
        onSuccess: async () => {
          // The account exists now, the cookie that carried the token is no longer needed.
          if (IS_SELF_HOSTED) {
            clearInvitationTokenCookie();
          }
          toaster.create({
            title: 'Signup successful 🎉',
            description: 'Please verify your email before signing in. We just sent you a verification code.',
            type: 'success',
          });
          navigate({ to: '/verify-email', search: { email } });
        },
        onError: (ctx) => {
          setIsLoading(false);
          toaster.create({
            title: ctx.error.message,
            type: 'error',
          });
        },
      },
    );
  };

  return (
    <Stack asChild gap="7" mt="6">
      <motion.div
        initial={{ x: '50px', opacity: 0 }}
        animate={{ x: '0%', opacity: 1, transition: { duration: 0.6, bounce: 0, delay: 0.2 } }}
        exit={{ x: '-50px', opacity: 0 }}
      >
        <Text textStyle="sm" color="fg.muted">
          Already have an account?{' '}
          <Link asChild variant="underline">
            <RouterLink to="/login">Sign in</RouterLink>
          </Link>
        </Text>

        <Stack gap={{ base: '2', md: '3' }}>
          <Heading size={{ base: '2xl', md: '3xl' }}>Sign up</Heading>
          <Text textStyle="md" color="fg.muted">
            Start using Vemetric to get valuable insights
          </Text>
        </Stack>

        <Stack gap="6">
          <Stack as="form" gap="5" onSubmit={onSubmit}>
            <Field.Root>
              <Field.Label>Email</Field.Label>
              <InputGroup startElement={<TbMail />} width="full">
                <Input
                  disabled={isLoading}
                  type="email"
                  placeholder="me@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                />
              </InputGroup>
            </Field.Root>
            <Field.Root>
              <Field.Label>Password</Field.Label>
              <InputGroup startElement={<TbLock />} width="full">
                <Input
                  disabled={isLoading}
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  minLength={8}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                />
              </InputGroup>
            </Field.Root>
            <Button type="submit" colorPalette="purple" loading={isLoading}>
              Sign up
            </Button>
            {/* The whole social section, divider included, is omitted when no provider is configured. */}
            {hasSocialProviders && (
              <HStack>
                <Separator flex="1" />
                <Text flexShrink="0" fontSize="xs">
                  Or continue with
                </Text>
                <Separator flex="1" />
              </HStack>
            )}
            {hasSocialProviders && (
              <HStack>
                {isSocialProviderEnabled('google') && (
                  <Button
                    type="button"
                    variant="surface"
                    flex="1"
                    onClick={() => loginWithProvider('google', setIsLoading)}
                  >
                    <TbBrandGoogleFilled />
                    Google
                  </Button>
                )}
                {isSocialProviderEnabled('github') && (
                  <Button
                    type="button"
                    flex="1"
                    variant="solid"
                    onClick={() => loginWithProvider('github', setIsLoading)}
                  >
                    <TbBrandGithub />
                    GitHub
                  </Button>
                )}
              </HStack>
            )}
          </Stack>

          {/* Self hosted instances have no relationship with Vemetric's own legal terms. */}
          {!IS_SELF_HOSTED && (
            <Text textStyle="sm" color="fg.muted" textAlign="center">
              By signing up you accept our{' '}
              <Link href="https://vemetric.com/legal" target="_blank" variant="underline">
                Legal Terms
              </Link>
            </Text>
          )}
        </Stack>
      </motion.div>
    </Stack>
  );
}
