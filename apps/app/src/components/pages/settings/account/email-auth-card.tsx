import { Box, Button, Card, Flex, Input, Stack, Text, Field, Badge } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { TbAt, TbCheck, TbLock, TbMail } from 'react-icons/tb';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { getAppUrl } from '@/utils/url';

interface EmailAuthCardProps {
  email: string;
  hasPassword: boolean;
  onUpdate: () => Promise<void>;
}

export const EmailAuthCard = ({ email: initialEmail, hasPassword, onUpdate }: EmailAuthCardProps) => {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sentResetLink, setSentResetLink] = useState(false);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (email === initialEmail) {
      return;
    }

    if (!email.includes('@')) {
      toaster.create({
        title: 'Please enter a valid email address',
        type: 'error',
      });
      return;
    }

    setIsEmailLoading(true);
    const result = await authClient.changeEmail({
      newEmail: email,
      callbackURL: getAppUrl() + '/?changeEmail=true',
    });
    setIsEmailLoading(false);

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to update email',
        type: 'error',
      });
    } else {
      setShowEmailForm(false);
      toaster.create({
        title: 'Verification email sent to your new address',
        description: 'Please check your inbox and verify the new email.',
        type: 'success',
      });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentPassword.length < 8) {
      toaster.create({
        title: 'Please enter your current password',
        type: 'error',
      });
      return;
    }

    if (newPassword.length < 8) {
      toaster.create({
        title: 'New password must be at least 8 characters',
        type: 'error',
      });
      return;
    }

    setIsPasswordLoading(true);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
    });
    setIsPasswordLoading(false);

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to change password',
        type: 'error',
      });
    } else {
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordForm(false);
      await onUpdate();
      toaster.create({
        title: 'Password changed successfully',
        type: 'success',
      });
    }
  };

  const handleSetPassword = async () => {
    if (sentResetLink) return;

    setIsPasswordLoading(true);
    const result = await authClient.requestPasswordReset({
      email: initialEmail,
      redirectTo: getAppUrl() + '/reset-password',
    });
    setIsPasswordLoading(false);

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to send password reset link',
        type: 'error',
      });
    } else {
      setSentResetLink(true);
      toaster.create({
        title: 'Password reset link sent',
        description: 'Check your email to set a password.',
        type: 'success',
      });
    }
  };

  return (
    <Card.Root>
      <Card.Body p={4}>
        <Flex justify="space-between" align="flex-start">
          <Flex align="center" gap={3}>
            <Box fontSize="xl" color="fg.muted">
              <TbAt />
            </Box>
            <Box>
              <Text fontWeight="semibold">Email</Text>
              <Text fontSize="sm" color="fg.muted">
                {hasPassword ? 'You can use your email to sign in' : 'Set a password to sign in with your email'}
              </Text>
            </Box>
          </Flex>
          {hasPassword && (
            <Badge colorPalette="green" variant="outline">
              <TbCheck />
              Connected
            </Badge>
          )}
        </Flex>

        <Flex
          mt={4}
          pt={4}
          borderTopWidth="1px"
          borderColor="border.muted"
          justify="space-between"
          align="center"
          flexWrap="wrap"
          gap={2}
        >
          <Text fontSize="sm" color="fg.muted">
            {initialEmail}
          </Text>
          <Flex gap={2}>
            <Button size="sm" variant="surface" onClick={() => setShowEmailForm(!showEmailForm)}>
              Change email
            </Button>
            {hasPassword ? (
              <Button size="sm" variant="surface" onClick={() => setShowPasswordForm(!showPasswordForm)}>
                Change password
              </Button>
            ) : (
              <Button
                size="sm"
                variant="surface"
                loading={isPasswordLoading}
                disabled={sentResetLink}
                onClick={handleSetPassword}
              >
                {sentResetLink ? 'Link sent' : 'Set password'}
              </Button>
            )}
          </Flex>
        </Flex>

        {showEmailForm && (
          <Box mt={4} pt={4} borderTopWidth="1px" borderColor="border.muted" as="form" onSubmit={handleEmailUpdate}>
            <Stack gap={3}>
              <Field.Root>
                <Field.Label>New Email</Field.Label>
                <InputGroup startElement={<TbMail />} width="full">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isEmailLoading}
                  />
                </InputGroup>
                <Field.HelperText>A verification email will be sent to the new address.</Field.HelperText>
              </Field.Root>
              <Flex gap={2} justifyContent="flex-end">
                <Button size="sm" variant="ghost" onClick={() => setShowEmailForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isEmailLoading} disabled={email === initialEmail}>
                  Update Email
                </Button>
              </Flex>
            </Stack>
          </Box>
        )}

        {showPasswordForm && hasPassword && (
          <Box mt={4} pt={4} borderTopWidth="1px" borderColor="border.muted" as="form" onSubmit={handlePasswordChange}>
            <Stack gap={3}>
              <Field.Root>
                <Field.Label>Current Password</Field.Label>
                <InputGroup startElement={<TbLock />} width="full">
                  <Input
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={isPasswordLoading}
                  />
                </InputGroup>
              </Field.Root>
              <Field.Root>
                <Field.Label>New Password</Field.Label>
                <InputGroup startElement={<TbLock />} width="full">
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isPasswordLoading}
                  />
                </InputGroup>
                <Field.HelperText>Minimum 8 characters</Field.HelperText>
              </Field.Root>
              <Flex gap={2} justifyContent="flex-end">
                <Button size="sm" variant="ghost" onClick={() => setShowPasswordForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={isPasswordLoading}>
                  Change Password
                </Button>
              </Flex>
            </Stack>
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
};
