import { Field, Input, Heading, Text, HStack, Stack, Link, Button, Separator, Badge, Flex } from '@chakra-ui/react';
import { createFileRoute, Link as RouterLink } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { useState } from 'react';
import { TbBrandGithub, TbBrandGoogleFilled, TbLock, TbMail } from 'react-icons/tb';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { authClient, loginWithProvider } from '@/utils/auth';

export const Route = createFileRoute('/_auth/login')({
  component: Page,
});

function Page() {
  const lastMethod = authClient.getLastUsedLoginMethod();
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sentResetPasswordLink, setSentResetPasswordLink] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    authClient.signIn.email(
      {
        email,
        password,
        rememberMe,
      },
      {
        onRequest: () => {
          setPassword('');
          setIsLoading(true);
        },
        onError: (ctx) => {
          setIsLoading(false);
          if (ctx.error.code === 'EMAIL_NOT_VERIFIED') {
            toaster.create({
              title: 'Please verify your email before signing in.',
              description: 'We just sent you another verification link.',
              type: 'error',
            });
          } else {
            toaster.create({
              title: ctx.error.message,
              type: 'error',
            });
          }
        },
      },
    );
  };

  return (
    <Stack asChild gap="7" mt="10">
      <motion.div
        initial={{ x: '50px', opacity: 0 }}
        animate={{ x: '0%', opacity: 1, transition: { duration: 0.6, bounce: 0, delay: 0.2 } }}
        exit={{ x: '-50px', opacity: 0 }}
      >
        <Text textStyle="sm" color="fg.muted">
          Don&apos;t have an account?{' '}
          <Link asChild variant="underline">
            <RouterLink to="/signup">Sign up</RouterLink>
          </Link>
        </Text>

        <Stack gap={{ base: '2', md: '3' }}>
          <Heading size={{ base: '2xl', md: '3xl' }}>Sign in</Heading>
        </Stack>

        <Stack gap="6">
          <Stack as="form" gap="5" onSubmit={onSubmit}>
            <Field.Root>
              <Field.Label gap={2}>
                Email
                {lastMethod === 'email' && (
                  <Badge colorPalette="blue" variant="solid">
                    Last used
                  </Badge>
                )}
              </Field.Label>
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                />
              </InputGroup>
            </Field.Root>
            <HStack justify="space-between">
              <Checkbox
                colorPalette="purple"
                checked={rememberMe}
                onCheckedChange={(e) => setRememberMe(e.checked === true)}
                disabled={isLoading}
              >
                Remember me
              </Checkbox>
              <Link
                variant="plain"
                colorPalette="gray"
                onClick={async () => {
                  if (sentResetPasswordLink) {
                    return;
                  }

                  if (email.length < 3) {
                    toaster.create({
                      title: 'Please enter a valid email address',
                      type: 'error',
                    });
                    return;
                  }

                  const res = await authClient.forgetPassword({
                    email,
                    redirectTo: 'https://' + window.location.hostname + '/reset-password',
                  });

                  if (res.error) {
                    if (res.error.code === 'VALIDATION_ERROR') {
                      toaster.create({
                        title: 'Please enter a valid email address',
                        type: 'error',
                      });
                    } else {
                      toaster.create({
                        title: res.error.message,
                        type: 'error',
                      });
                    }
                  } else {
                    setSentResetPasswordLink(true);
                    toaster.create({
                      title: 'We just sent you a password reset link.',
                      type: 'success',
                    });
                  }
                }}
              >
                Forgot password?
              </Link>
            </HStack>
            <Button type="submit" colorPalette="purple" loading={isLoading}>
              Sign in
            </Button>
            <HStack>
              <Separator flex="1" />
              <Text flexShrink="0" fontSize="xs">
                or Sign in with
              </Text>
              <Separator flex="1" />
            </HStack>
            <HStack gap="4">
              <Flex flex="1" pos="relative">
                <Button
                  type="button"
                  flex="1"
                  variant="surface"
                  loading={isLoading}
                  onClick={() => loginWithProvider('google', setIsLoading)}
                >
                  <TbBrandGoogleFilled />
                  Google
                </Button>
                {lastMethod === 'google' && (
                  <Badge pos="absolute" top="-2.5" right="-2.5" colorPalette="blue" variant="solid">
                    Last used
                  </Badge>
                )}
              </Flex>
              <Flex flex="1" pos="relative">
                <Button
                  type="button"
                  flex="1"
                  variant="solid"
                  loading={isLoading}
                  onClick={() => loginWithProvider('github', setIsLoading)}
                >
                  <TbBrandGithub />
                  GitHub
                </Button>
                {lastMethod === 'github' && (
                  <Badge pos="absolute" top="-2.5" right="-2.5" colorPalette="blue" variant="solid">
                    Last used
                  </Badge>
                )}
              </Flex>
            </HStack>
          </Stack>

          <Text textStyle="sm" color="fg.muted" textAlign="center">
            By logging in you accept our{' '}
            <Link href="https://vemetric.com/legal" target="_blank" variant="underline">
              Legal Terms
            </Link>
          </Text>
        </Stack>
      </motion.div>
    </Stack>
  );
}
