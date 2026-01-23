# Avatar Upload Implementation Plan

## Overview

Enable users to upload custom avatar images with a simple cropping mechanism in the existing account settings dialog.

## Existing Infrastructure

The following components already exist and will be extended:

| Component | Path | Status |
|-----------|------|--------|
| Account settings dialog | `apps/webapp/src/components/pages/settings/account/account-settings-dialog.tsx` | Exists |
| General settings tab | `apps/webapp/src/components/pages/settings/account/general-tab.tsx` | Extend |
| Account router | `apps/backend/src/routes/account.ts` | Extend |
| Account avatar component | `apps/webapp/src/components/account-avatar.tsx` | No changes needed |

## Key Decisions

### Storage Strategy

**Approach:** S3-compatible storage (Cloudflare R2) as an optional feature.

| Scenario | S3/R2 Configured | Avatar Upload |
|----------|------------------|---------------|
| SaaS deployment | Yes (R2) | Enabled |
| Self-hosted (minimal) | No | Disabled - fallback to initials |
| Self-hosted (full) | Yes (S3/MinIO/R2) | Enabled |

**Rationale:** Avatars are nice-to-have, not critical. Self-hosters who don't want to configure object storage simply won't have avatar uploads. This avoids implementing and maintaining local filesystem storage.

### Fallback for Disabled Uploads

When storage is not configured:
- Use Chakra UI's `<Avatar.Fallback name="..." />` which generates initial-based avatars (already implemented)
- Hide the upload button in the UI

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
AWS_S3_PUBLIC_URL=https://avatars.vemetric.com  # Optional: custom domain for public access
```

---

## Backend Implementation

### 1. Storage Utility

**File:** `apps/backend/src/utils/storage.ts` (NEW)

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
    if (process.env.AWS_S3_PUBLIC_URL) {
      return `${process.env.AWS_S3_PUBLIC_URL}/${key}`;
    }
    // Default R2 public URL format
    return `https://${process.env.AWS_S3_BUCKET}.${process.env.AWS_S3_ENDPOINT?.replace('https://', '')}/${key}`;
  },

  extractKeyFromUrl(url: string): string | null {
    const match = url.match(/avatars\/[^?]+/);
    return match ? match[0] : null;
  },
};
```

### 2. Extend Account Router

**File:** `apps/backend/src/routes/account.ts` (MODIFY)

Add the following procedures to the existing router:

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { dbAuthUser } from 'database';
import { loggedInProcedure, router } from '../utils/trpc';
import { storage, isStorageConfigured } from '../utils/storage';

export const accountRouter = router({
  // EXISTING: settings query stays as-is, but add avatarUploadsEnabled
  settings: loggedInProcedure.query(async (opts) => {
    const { user } = opts.ctx;
    const linkedAccounts = await dbAuthUser.getLinkedAccounts(user.id);

    const accounts = linkedAccounts.map((account) => ({
      id: account.id,
      provider: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt,
    }));

    const hasPassword = accounts.some((account) => account.provider === 'credential');

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
      },
      accounts,
      hasPassword,
      avatarUploadsEnabled: isStorageConfigured(), // ADD THIS
    };
  }),

  // NEW: Get presigned URL for avatar upload
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

  // NEW: Confirm avatar upload and update user record
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

  // NEW: Delete avatar
  deleteAvatar: loggedInProcedure.mutation(async ({ ctx }) => {
    if (ctx.var.user.image) {
      if (isStorageConfigured()) {
        const key = storage.extractKeyFromUrl(ctx.var.user.image);
        if (key) {
          await storage.delete(key).catch(() => {});
        }
      }
      await dbAuthUser.update(ctx.var.user.id, { image: null });
    }
    return { success: true };
  }),
});
```

### 3. Dependencies

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

**File:** `apps/webapp/src/components/avatar-cropper.tsx` (NEW)

```typescript
import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Button, Flex, Box, Text } from '@chakra-ui/react';
import { Slider } from '@/components/ui/slider';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '@/components/ui/dialog';

interface AvatarCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
  isLoading?: boolean;
}

export function AvatarCropper({ image, open, onClose, onCropComplete, isLoading }: AvatarCropperProps) {
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
    <DialogRoot
      open={open}
      onOpenChange={({ open }) => {
        if (!open) onClose();
      }}
    >
      <DialogContent maxW="500px">
        <DialogHeader>
          <DialogTitle>Crop Avatar</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Box position="relative" h="300px" bg="black" borderRadius="md" overflow="hidden">
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
            <Text fontSize="sm" color="fg.muted" flexShrink={0}>
              Zoom
            </Text>
            <Slider
              value={[zoom]}
              onValueChange={({ value }) => onZoomChange(value[0])}
              min={1}
              max={3}
              step={0.1}
              flex={1}
            />
          </Flex>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button colorPalette="blue" onClick={handleConfirm} loading={isLoading}>
            Save
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
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
    canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.85);
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

### 3. Extend General Tab with Avatar Section

**File:** `apps/webapp/src/components/pages/settings/account/general-tab.tsx` (MODIFY)

Add avatar section to the existing ProfileSection or create a new AvatarSection:

```typescript
import { useRef, useState } from 'react';
import { Avatar, Box, Button, Card, Flex, Input, Spinner, Stack, Text, Field } from '@chakra-ui/react';
import { TbCamera, TbSettings, TbTrash, TbUser } from 'react-icons/tb';
import { AvatarCropper } from '@/components/avatar-cropper';
import { CardIcon } from '@/components/card-icon';
import { InputGroup } from '@/components/ui/input-group';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { trpc } from '@/utils/trpc';

// Add new AvatarSection component
interface AvatarSectionProps {
  image: string | null;
  name: string | null;
  avatarUploadsEnabled: boolean;
  onUpdate: () => Promise<void>;
}

const AvatarSection = ({ image, name, avatarUploadsEnabled, onUpdate }: AvatarSectionProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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
    try {
      await deleteAvatar.mutateAsync();
      toaster.create({ title: 'Avatar removed', type: 'success' });
      await onUpdate();
    } catch (error) {
      toaster.create({ title: 'Failed to remove avatar', type: 'error' });
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
                disabled={isUploading}
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

// Update AccountGeneralTab to include AvatarSection
export const AccountGeneralTab = () => {
  const { refetch: refetchAuth } = authClient.useSession();
  const { data: settings, error, refetch, isLoading: isSettingsLoading } = trpc.account.settings.useQuery();

  // ... existing loading/error handling ...

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
```

---

## Upload Flow

```
User clicks "Change Avatar" in Account Settings > General tab
         │
         ▼
File picker opens (accept: jpg, png, webp)
         │
         ▼
User selects image (validated: type, <5MB)
         │
         ▼
Crop dialog opens (react-easy-crop)
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
│   │   └── account.ts                 # MODIFY - add upload mutations
│   └── utils/
│       └── storage.ts                 # NEW - S3/R2 utilities

apps/webapp/
├── src/
│   └── components/
│       ├── avatar-cropper.tsx         # NEW - crop dialog
│       └── pages/settings/account/
│           └── general-tab.tsx        # MODIFY - add AvatarSection
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

Options:
- Enable public access on the bucket
- Set up a custom domain with Cloudflare CDN (recommended for production)
- Use `AWS_S3_PUBLIC_URL` env var to specify custom domain

---

## Dependencies Summary

**Backend:**
```bash
cd apps/backend
bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**Frontend:**
```bash
cd apps/webapp
bun add react-easy-crop
```

---

## Testing Checklist

- [ ] Upload JPG, PNG, WebP images
- [ ] Reject files > 5MB
- [ ] Reject non-image files
- [ ] Crop and zoom functionality works
- [ ] Avatar updates immediately in dialog and header
- [ ] Old avatar is deleted from storage
- [ ] Delete avatar functionality works
- [ ] Graceful handling when storage not configured (button hidden)
- [ ] Error states display appropriate messages
- [ ] Session/auth state updates after avatar change
