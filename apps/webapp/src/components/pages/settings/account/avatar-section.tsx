import { Button, Flex, Stack, Text } from '@chakra-ui/react';
import { useRef, useState } from 'react';
import { TbCamera, TbTrash } from 'react-icons/tb';
import { AccountAvatar } from '@/components/account-avatar';
import { AvatarCropper } from '@/components/avatar-cropper';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';

export interface AvatarSectionProps {
  onUpdate: () => Promise<void>;
}

export const AvatarSection = ({ onUpdate }: AvatarSectionProps) => {
  const { data: settings } = trpc.account.settings.useQuery();
  const avatarUploadsEnabled = settings?.avatarUploadsEnabled ?? false;
  const image = settings?.user.image ?? null;

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
    } catch {
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
    } catch {
      toaster.create({ title: 'Failed to remove avatar', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Flex align="center" gap={4}>
        <AccountAvatar />

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
            Avatar uploads are not enabled.
          </Text>
        )}
      </Flex>

      {selectedImage && (
        <AvatarCropper
          image={selectedImage}
          open={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          onCropComplete={handleCropComplete}
          isLoading={isUploading}
        />
      )}
    </>
  );
};
