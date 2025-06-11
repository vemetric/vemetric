import { Stack, Heading, Input, Button, Text, Link, Field } from '@chakra-ui/react';
import { createFileRoute, Link as RouterLink, useNavigate, Navigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { motion } from 'motion/react';
import { useState } from 'react';
import { TbLock } from 'react-icons/tb';
import { z } from 'zod';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';

const resetPasswordSchema = z.object({
  token: z.string().optional().catch(''),
});

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: zodValidator(resetPasswordSchema),
  component: Page,
});

function Page() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');

  if (!token) {
    return <Navigate to="/login" />;
  }

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

    authClient.resetPassword(
      {
        newPassword: password,
        token,
      },
      {
        onRequest: () => {
          setIsLoading(true);
        },
        onSuccess: async () => {
          toaster.create({
            title: 'Password reset successful',
            description: 'Sign in to continue',
            type: 'success',
          });
          navigate({ to: '/login' });
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
          Do you know your password?{' '}
          <Link asChild variant="underline">
            <RouterLink to="/login">Sign in</RouterLink>
          </Link>
        </Text>

        <Stack gap={{ base: '2', md: '3' }}>
          <Heading size={{ base: '2xl', md: '3xl' }}>Reset password</Heading>
          <Text textStyle="md" color="fg.muted">
            Enter your new password
          </Text>
        </Stack>

        <Stack gap="6">
          <Stack as="form" gap="5" onSubmit={onSubmit}>
            <Field.Root>
              <Field.Label>New password</Field.Label>
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
              Reset password
            </Button>
          </Stack>
        </Stack>
      </motion.div>
    </Stack>
  );
}
