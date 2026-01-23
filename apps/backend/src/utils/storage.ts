import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
      })
    );
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
