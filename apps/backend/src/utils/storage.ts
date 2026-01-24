import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@vemetric/logger';

export const isStorageConfigured = (): boolean => {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
};

// Cached S3 client singleton
let s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!isStorageConfigured()) {
    throw new Error('Storage is not configured');
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_S3_REGION || 'auto',
      endpoint: process.env.AWS_S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  return s3Client;
};

export const storage = {
  async getSignedUploadUrl(key: string, contentType: string, contentLength: number): Promise<string> {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes
  },

  async delete(key: string): Promise<void> {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      }),
    );
  },

  getPublicUrl(key: string): string {
    if (process.env.AWS_S3_PUBLIC_URL) {
      return `${process.env.AWS_S3_PUBLIC_URL}/${key}`;
    }

    // Require AWS_S3_PUBLIC_URL for production use
    // Fallback for development only
    const endpoint = process.env.AWS_S3_ENDPOINT || '';
    const bucket = process.env.AWS_S3_BUCKET || '';
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, '');

    if (!cleanEndpoint || !bucket) {
      logger.warn('AWS_S3_PUBLIC_URL not configured, using constructed URL');
    }

    return `https://${bucket}.${cleanEndpoint}/${key}`;
  },

  extractKeyFromUrl(url: string): string | null {
    // Match avatar keys with UUID pattern: avatars/{userId}/{uuid}.webp
    const match = url.match(/avatars\/[a-zA-Z0-9_-]+\/[a-f0-9-]+\.webp/);
    return match ? match[0] : null;
  },
};
