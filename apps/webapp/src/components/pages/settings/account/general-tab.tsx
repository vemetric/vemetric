import { AbsoluteCenter, Avatar, Box, Button, Card, Flex, Input, Spinner, Stack, Text, Field } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { TbCamera, TbSettings, TbTrash, TbUser } from 'react-icons/tb';
import { AvatarCropper } from '@/components/avatar-cropper';
import { CardIcon } from '@/components/card-icon';
import { ErrorState } from '@/components/ui/empty-state';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { trpc } from '@/utils/trpc';

export const AccountGeneralTab = () => {
  const { refetch: refetchAuth } = authClient.useSession();
  const { data: settings, error, refetch, isLoading: isSettingsLoading } = trpc.account.settings.useQuery();

  if (error) {
    return <ErrorState title="Error loading settings" />;
  }

  if (isSettingsLoading) {
    return (
      <Box h="200px" pos="relative">
        <AbsoluteCenter>
          <Spinner />
        </AbsoluteCenter>
      </Box>
    );
  }

  if (!settings) {
    return <ErrorState title="Account not found" />;
  }

  const refreshData = async () => {
    await Promise.all([refetch(), refetchAuth()]);
  };

  return (
    <Flex flexDir="column" gap={4} p={4}>
      <AvatarSection
        image={settings.user.image}
        name={settings.user.name}
        avatarUploadsEnabled={settings.avatarUploadsEnabled}
        onUpdate={refreshData}
      />
      <ProfileSection name={settings.user.name ?? ''} onUpdate={refreshData} />
    </Flex>
  );
};

interface AvatarSectionProps {
  image: string | null | undefined;
  name: string | null | undefined;
  avatarUploadsEnabled: boolean;
  onUpdate: () => Promise<void>;
}

const AvatarSection = ({ image, name, avatarUploadsEnabled, onUpdate }: AvatarSectionProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = trpc.account.getAvatarUploadUrl.useMutation();
  const confirmUpload = trpc.account.confirmAvatarUpload.useMutation();
  const deleteAvatar = trpc.account.deleteAvatar.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toaster.create({ title: 'Please select a JPG, PNG, or WebP image', type: 'error' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toaster.create({ title: 'Image must be less than 5MB', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsUploading(true);

    try {
      const { uploadUrl, key } = await getUploadUrl.mutateAsync({
        contentType: 'image/webp',
        fileSize: croppedBlob.size,
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: croppedBlob,
        headers: { 'Content-Type': 'image/webp' },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      await confirmUpload.mutateAsync({ key });

      toaster.create({ title: 'Avatar updated successfully', type: 'success' });
      setSelectedImage(null);
      await onUpdate();
    } catch (error) {
      toaster.create({ title: 'Failed to upload avatar', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setIsDeleting(true);
    try {
      await deleteAvatar.mutateAsync();
      toaster.create({ title: 'Avatar removed', type: 'success' });
      await onUpdate();
    } catch (error) {
      toaster.create({ title: 'Failed to remove avatar', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <CardIcon>
            <TbCamera />
          </CardIcon>
          <Text fontWeight="semibold">Profile Picture</Text>
        </Flex>
      </Card.Header>
      <Card.Body p={4}>
        <Flex align="center" gap={4}>
          <Avatar.Root size="2xl">
            <Avatar.Fallback name={name || '?'} />
            {image && <Avatar.Image src={image} />}
          </Avatar.Root>

          {avatarUploadsEnabled ? (
            <Stack gap={2}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isDeleting}
              >
                <TbCamera />
                Change Avatar
              </Button>
              {image && (
                <Button
                  variant="ghost"
                  size="sm"
                  colorPalette="red"
                  onClick={handleDeleteAvatar}
                  disabled={isUploading}
                  loading={isDeleting}
                >
                  <TbTrash />
                  Remove
                </Button>
              )}
            </Stack>
          ) : (
            <Text fontSize="sm" color="fg.muted">
              Avatar uploads are not available on this instance
            </Text>
          )}
        </Flex>
      </Card.Body>

      {selectedImage && (
        <AvatarCropper
          image={selectedImage}
          open={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          onCropComplete={handleCropComplete}
          isLoading={isUploading}
        />
      )}
    </Card.Root>
  );
};

interface ProfileSectionProps {
  name: string;
  onUpdate: () => Promise<void>;
}

const ProfileSection = ({ name: initialName, onUpdate }: ProfileSectionProps) => {
  const [isNameLoading, setIsNameLoading] = useState(false);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (name.length < 2) {
      toaster.create({
        title: 'Name must be at least 2 characters',
        type: 'error',
      });
      return;
    }

    setIsNameLoading(true);
    const result = await authClient.updateUser({ name });
    setIsNameLoading(false);

    if (result.error) {
      toaster.create({
        title: result.error.message || 'Failed to update name',
        type: 'error',
      });
    } else {
      await onUpdate();
      toaster.create({
        title: 'Name updated successfully',
        type: 'success',
      });
    }
  };

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <CardIcon>
            <TbSettings />
          </CardIcon>
          <Text fontWeight="semibold">General Settings</Text>
        </Flex>
      </Card.Header>
      <Card.Body p={4} pb={3}>
        <Stack gap="4" as="form" onSubmit={handleNameUpdate}>
          <Field.Root>
            <Field.Label>Name</Field.Label>
            <InputGroup startElement={<TbUser />} width="full">
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isNameLoading}
              />
            </InputGroup>
          </Field.Root>
          <Flex justifyContent="flex-end">
            <Button type="submit" size="sm" loading={isNameLoading} disabled={name === initialName}>
              Update Name
            </Button>
          </Flex>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
