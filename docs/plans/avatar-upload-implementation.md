# Avatar Upload Implementation Plan

## Overview

Enable users to upload custom avatar images with a simple cropping mechanism in account settings.

## Key Decisions

### Storage Strategy

**Approach:** S3-compatible storage (Cloudflare R2) as an optional feature.

| Scenario | S3/R2 Configured | Avatar Upload |
|----------|------------------|---------------|
| SaaS deployment | Yes (R2) | Enabled |
| Self-hosted (minimal) | No | Disabled - fallback to initials/Gravatar |
| Self-hosted (full) | Yes (S3/MinIO/R2) | Enabled |

**Rationale:** Avatars are nice-to-have, not critical. Self-hosters who don't want to configure object storage simply won't have avatar uploads. This avoids implementing and maintaining local filesystem storage.

### Fallback for Disabled Uploads

When storage is not configured:
- Use Chakra UI's `<Avatar name="..." />` which generates initial-based avatars
- Optionally support Gravatar via email hash

---

## Environment Configuration

Add to `.env.example`:

```env
# Avatar Storage (Optional - enables avatar uploads when configured)
# Works with any S3-compatible service (AWS S3, Cloudflare R2, MinIO)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=vemetric-avatars
AWS_S3_REGION=auto
AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com  # Required for R2/MinIO
```

---

## Backend Implementation

### 1. Storage Utility

**File:** `apps/backend/src/utils/storage.ts`

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const isStorageConfigured = (): boolean => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );
};

const getS3Client = () => {
  if (!isStorageConfigured()) {
    throw new Error('Storage is not configured');
  }

  return new S3Client({
    region: process.env.AWS_S3_REGION || 'auto',
    endpoint: process.env.AWS_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
};

export const storage = {
  async getSignedUploadUrl(key: string, contentType: string): Promise<string> {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes
  },

  async delete(key: string): Promise<void> {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }));
  },

  getPublicUrl(key: string): string {
    // For R2 with public bucket or custom domain
    const publicDomain = process.env.AWS_S3_PUBLIC_URL ||
      `https://${process.env.AWS_S3_BUCKET}.${process.env.AWS_S3_ENDPOINT?.replace('https://', '')}`;
    return `${publicDomain}/${key}`;
  },

  extractKeyFromUrl(url: string): string | null {
    // Extract the key from a full URL for deletion
    const match = url.match(/avatars\/[^?]+/);
    return match ? match[0] : null;
  },
};
```

### 2. Account Router

**File:** `apps/backend/src/routes/account.ts`

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { loggedInProcedure, router } from '../utils/trpc';
import { dbAuthUser } from '@vemetric/database';
import { storage, isStorageConfigured } from '../utils/storage';

export const accountRouter = router({
  // Get current user profile
  getProfile: loggedInProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.var.user.id,
      name: ctx.var.user.name,
      email: ctx.var.user.email,
      image: ctx.var.user.image,
      avatarUploadsEnabled: isStorageConfigured(),
    };
  }),

  // Update profile name
  updateProfile: loggedInProcedure
    .input(z.object({
      name: z.string().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await dbAuthUser.update(ctx.var.user.id, { name: input.name });
      return { success: true };
    }),

  // Get presigned URL for avatar upload
  getAvatarUploadUrl: loggedInProcedure
    .input(z.object({
      contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      fileSize: z.number().max(5 * 1024 * 1024), // 5MB max
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Avatar uploads are not configured on this instance',
        });
      }

      const key = `avatars/${ctx.var.user.id}/${crypto.randomUUID()}.webp`;
      const uploadUrl = await storage.getSignedUploadUrl(key, input.contentType);

      return { uploadUrl, key };
    }),

  // Confirm avatar upload and update user record
  confirmAvatarUpload: loggedInProcedure
    .input(z.object({
      key: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Avatar uploads are not configured on this instance',
        });
      }

      // Validate key belongs to this user
      if (!input.key.startsWith(`avatars/${ctx.var.user.id}/`)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Invalid avatar key',
        });
      }

      const imageUrl = storage.getPublicUrl(input.key);

      // Delete old avatar if exists
      if (ctx.var.user.image) {
        const oldKey = storage.extractKeyFromUrl(ctx.var.user.image);
        if (oldKey) {
          await storage.delete(oldKey).catch(() => {
            // Log but don't fail if old avatar deletion fails
          });
        }
      }

      await dbAuthUser.update(ctx.var.user.id, { image: imageUrl });

      return { success: true, imageUrl };
    }),

  // Delete avatar
  deleteAvatar: loggedInProcedure.mutation(async ({ ctx }) => {
    if (ctx.var.user.image) {
      const key = storage.extractKeyFromUrl(ctx.var.user.image);
      if (key && isStorageConfigured()) {
        await storage.delete(key).catch(() => {});
      }
      await dbAuthUser.update(ctx.var.user.id, { image: null });
    }
    return { success: true };
  }),
});
```

### 3. Register Router

**File:** `apps/backend/src/index.ts`

Add import and register the router:

```typescript
import { accountRouter } from './routes/account';

const appRouter = router({
  // ... existing routers
  account: accountRouter,
});
```

### 4. Dependencies

```bash
cd apps/backend
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## Frontend Implementation

### 1. Dependencies

```bash
cd apps/webapp
bun add react-easy-crop
```

### 2. Avatar Cropper Component

**File:** `apps/webapp/src/components/avatar-cropper.tsx`

```typescript
import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import {
  Dialog,
  Button,
  Slider,
  Flex,
  Box,
  Text,
} from '@chakra-ui/react';

interface AvatarCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

export function AvatarCropper({ image, open, onClose, onCropComplete }: AvatarCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((value: number) => {
    setZoom(value);
  }, []);

  const onCropAreaChange = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    const croppedBlob = await getCroppedImage(image, croppedAreaPixels);
    onCropComplete(croppedBlob);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="500px">
          <Dialog.Header>
            <Dialog.Title>Crop Avatar</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Box position="relative" h="300px" bg="gray.900" borderRadius="md">
              <Cropper
                image={image}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropAreaChange}
              />
            </Box>
            <Flex align="center" gap={4} mt={4}>
              <Text fontSize="sm" color="fg.muted">Zoom</Text>
              <Slider
                value={[zoom]}
                onValueChange={(e) => onZoomChange(e.value[0])}
                min={1}
                max={3}
                step={0.1}
                flex={1}
              />
            </Flex>
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button colorPalette="blue" onClick={handleConfirm}>Save</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

// Helper function to crop the image using Canvas
async function getCroppedImage(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Output size (500x500 max)
  const size = Math.min(pixelCrop.width, 500);
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob!),
      'image/webp',
      0.85 // Quality
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = url;
  });
}
```

### 3. Avatar Uploader Component

**File:** `apps/webapp/src/components/avatar-uploader.tsx`

```typescript
import { useState, useRef } from 'react';
import { Button, Flex, Spinner } from '@chakra-ui/react';
import { AvatarCropper } from './avatar-cropper';
import { trpc } from '@/utils/trpc';
import { toaster } from '@/components/ui/toaster';

interface AvatarUploaderProps {
  onUploadComplete: (imageUrl: string) => void;
}

export function AvatarUploader({ onUploadComplete }: AvatarUploaderProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = trpc.account.getAvatarUploadUrl.useMutation();
  const confirmUpload = trpc.account.confirmAvatarUpload.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toaster.error({ title: 'Please select a JPG, PNG, or WebP image' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toaster.error({ title: 'Image must be less than 5MB' });
      return;
    }

    // Read file and open cropper
    const reader = new FileReader();
    reader.onload = () => setSelectedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setSelectedImage(null);
    setIsUploading(true);

    try {
      // 1. Get presigned upload URL
      const { uploadUrl, key } = await getUploadUrl.mutateAsync({
        contentType: 'image/webp',
        fileSize: croppedBlob.size,
      });

      // 2. Upload to S3/R2
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: croppedBlob,
        headers: {
          'Content-Type': 'image/webp',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      // 3. Confirm upload and update user record
      const { imageUrl } = await confirmUpload.mutateAsync({ key });

      toaster.success({ title: 'Avatar updated successfully' });
      onUploadComplete(imageUrl);
    } catch (error) {
      toaster.error({ title: 'Failed to upload avatar' });
      console.error('Avatar upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <Flex gap={2}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? <Spinner size="sm" /> : 'Change Avatar'}
        </Button>
      </Flex>

      {selectedImage && (
        <AvatarCropper
          image={selectedImage}
          open={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  );
}
```

### 4. Account Settings Page

**File:** `apps/webapp/src/pages/_layout/account.tsx`

```typescript
import { useState } from 'react';
import {
  Box,
  Heading,
  Card,
  Stack,
  Flex,
  Input,
  Button,
  Avatar,
  Text,
} from '@chakra-ui/react';
import { Field } from '@/components/ui/field';
import { AvatarUploader } from '@/components/avatar-uploader';
import { trpc } from '@/utils/trpc';
import { toaster } from '@/components/ui/toaster';

export default function AccountSettingsPage() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.account.getProfile.useQuery();
  const updateProfile = trpc.account.updateProfile.useMutation();
  const deleteAvatar = trpc.account.deleteAvatar.useMutation();

  const [name, setName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form with profile data
  if (profile && !isInitialized) {
    setName(profile.name || '');
    setIsInitialized(true);
  }

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({ name });
      toaster.success({ title: 'Profile updated' });
      utils.account.getProfile.invalidate();
    } catch (error) {
      toaster.error({ title: 'Failed to update profile' });
    }
  };

  const handleAvatarUploadComplete = (imageUrl: string) => {
    utils.account.getProfile.invalidate();
  };

  const handleDeleteAvatar = async () => {
    try {
      await deleteAvatar.mutateAsync();
      toaster.success({ title: 'Avatar removed' });
      utils.account.getProfile.invalidate();
    } catch (error) {
      toaster.error({ title: 'Failed to remove avatar' });
    }
  };

  if (isLoading) {
    return <Box p={8}>Loading...</Box>;
  }

  return (
    <Box maxW="600px" mx="auto" py={8} px={4}>
      <Heading size="lg" mb={6}>Account Settings</Heading>

      <Card.Root mb={6}>
        <Card.Header>
          <Card.Title>Profile</Card.Title>
        </Card.Header>
        <Card.Body>
          <Stack gap={6}>
            {/* Avatar Section */}
            <Flex align="center" gap={4}>
              <Avatar.Root size="2xl">
                <Avatar.Image src={profile?.image || undefined} />
                <Avatar.Fallback name={profile?.name || profile?.email} />
              </Avatar.Root>

              <Stack gap={2}>
                {profile?.avatarUploadsEnabled ? (
                  <>
                    <AvatarUploader onUploadComplete={handleAvatarUploadComplete} />
                    {profile?.image && (
                      <Button
                        variant="ghost"
                        size="sm"
                        colorPalette="red"
                        onClick={handleDeleteAvatar}
                      >
                        Remove
                      </Button>
                    )}
                  </>
                ) : (
                  <Text fontSize="sm" color="fg.muted">
                    Avatar uploads are not available on this instance
                  </Text>
                )}
              </Stack>
            </Flex>

            {/* Name Field */}
            <Field label="Display Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </Field>

            {/* Email (read-only) */}
            <Field label="Email">
              <Input value={profile?.email || ''} disabled />
            </Field>

            <Button
              colorPalette="blue"
              onClick={handleSave}
              loading={updateProfile.isPending}
              alignSelf="flex-start"
            >
              Save Changes
            </Button>
          </Stack>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}
```

### 5. Add Route Configuration

**File:** `apps/webapp/src/routes.ts` (or equivalent router config)

Add route for `/account` pointing to the account settings page.

### 6. Add Navigation Link

Update user menu/dropdown to include "Account Settings" link navigating to `/account`.

---

## Upload Flow

```
User clicks "Change Avatar"
         │
         ▼
File picker opens (accept: jpg, png, webp)
         │
         ▼
User selects image (validated: type, <5MB)
         │
         ▼
Crop modal opens (react-easy-crop)
         │
         ▼
User adjusts crop area + zoom
         │
         ▼
User clicks "Save"
         │
         ▼
Canvas crops image → WebP blob (500x500, ~100KB)
         │
         ▼
Frontend calls: account.getAvatarUploadUrl
         │
         ▼
Backend returns: { uploadUrl, key }
         │
         ▼
Frontend PUTs blob directly to S3/R2
         │
         ▼
Frontend calls: account.confirmAvatarUpload({ key })
         │
         ▼
Backend validates key ownership
         │
         ▼
Backend deletes old avatar (if exists)
         │
         ▼
Backend updates user.image in PostgreSQL
         │
         ▼
Frontend invalidates queries, shows new avatar
```

---

## File Structure

```
apps/backend/
├── src/
│   ├── routes/
│   │   └── account.ts                 # NEW
│   ├── utils/
│   │   └── storage.ts                 # NEW
│   └── index.ts                       # MODIFY - add account router

apps/webapp/
├── src/
│   ├── components/
│   │   ├── avatar-cropper.tsx         # NEW
│   │   └── avatar-uploader.tsx        # NEW
│   └── pages/
│       └── _layout/
│           └── account.tsx            # NEW
```

---

## Security Considerations

1. **File type validation** - Validate MIME type client-side and enforce via presigned URL content-type
2. **File size limits** - 5MB max raw, ~100KB after compression
3. **Key ownership validation** - Ensure key starts with `avatars/{userId}/`
4. **Presigned URL expiry** - 5 minute TTL
5. **Old avatar cleanup** - Delete previous avatar to prevent storage bloat
6. **CORS configuration** - Configure S3/R2 bucket to allow PUT from webapp domain

---

## R2 Bucket Configuration

### CORS Policy

```json
[
  {
    "AllowedOrigins": ["https://app.vemetric.com", "http://localhost:4000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

### Public Access

Either:
- Enable public access on the bucket, OR
- Set up a custom domain with Cloudflare CDN, OR
- Use signed URLs for reading (adds complexity)

---

## Dependencies Summary

**Backend:**
```bash
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Frontend:**
```bash
bun add react-easy-crop
```

---

## Testing Checklist

- [ ] Upload JPG, PNG, WebP images
- [ ] Reject files > 5MB
- [ ] Reject non-image files
- [ ] Crop and zoom functionality works
- [ ] Avatar updates immediately after upload
- [ ] Old avatar is deleted from storage
- [ ] Delete avatar functionality works
- [ ] Graceful handling when storage not configured
- [ ] Error states display appropriate messages
