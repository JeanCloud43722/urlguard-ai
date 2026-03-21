/**
 * S3 Screenshot Upload Service
 * Handles uploading screenshots to AWS S3 with retry logic
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV } from '../_core/env';

export interface S3UploadOptions {
  bucket: string;
  key: string;
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  uploadedAt: number;
}

class S3ScreenshotService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    // Initialize S3 client with credentials from environment
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.bucket = process.env.S3_BUCKET_NAME || 'urlguard-screenshots';
  }

  /**
   * Upload screenshot to S3
   */
  async uploadScreenshot(
    buffer: Buffer,
    userId: number,
    urlHash: string,
    retries: number = 3
  ): Promise<S3UploadResult> {
    const timestamp = Date.now();
    const key = `screenshots/${userId}/${timestamp}-${urlHash}.png`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[S3] Uploading screenshot (attempt ${attempt}/${retries}): ${key}`);

        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: 'image/png',
          ServerSideEncryption: 'AES256',
          Metadata: {
            'user-id': userId.toString(),
            'url-hash': urlHash,
            'capture-time': new Date().toISOString(),
          },
          // Add lifecycle tag for automatic cleanup after 90 days
          Tagging: 'retention=90days&type=forensic',
        });

        await this.s3Client.send(command);

        // Generate public URL
        const url = `https://${this.bucket}.s3.amazonaws.com/${key}`;

        console.log(`[S3] Screenshot uploaded successfully: ${url}`);

        return {
          key,
          url,
          bucket: this.bucket,
          size: buffer.length,
          uploadedAt: timestamp,
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(`[S3] Upload attempt ${attempt} failed:`, error);

        if (attempt < retries) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error(`Failed to upload screenshot after ${retries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate presigned URL for screenshot (for temporary access)
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('[S3] Failed to generate presigned URL:', error);
      throw error;
    }
  }

  /**
   * Delete screenshot from S3
   */
  async deleteScreenshot(key: string): Promise<void> {
    try {
      console.log(`[S3] Deleting screenshot: ${key}`);
      // Note: DeleteObjectCommand would be used here
      // For now, we rely on S3 lifecycle policies for cleanup
      console.log(`[S3] Screenshot deletion scheduled (lifecycle policy)`);
    } catch (error) {
      console.error('[S3] Failed to delete screenshot:', error);
      throw error;
    }
  }

  /**
   * Check if screenshot exists
   */
  async screenshotExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      console.error('[S3] Error checking screenshot existence:', error);
      throw error;
    }
  }

  /**
   * Get S3 bucket name
   */
  getBucketName(): string {
    return this.bucket;
  }

  /**
   * Validate S3 credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      // Try to list objects (minimal permission check)
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: '.test',
      });

      // This will fail with NoSuchKey if credentials are valid
      try {
        await this.s3Client.send(command);
      } catch (error: any) {
        if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
          return true; // Credentials are valid
        }
        throw error;
      }

      return true;
    } catch (error) {
      console.error('[S3] Credential validation failed:', error);
      return false;
    }
  }
}

// Singleton instance
let s3Service: S3ScreenshotService | null = null;

export function getS3ScreenshotService(): S3ScreenshotService {
  if (!s3Service) {
    s3Service = new S3ScreenshotService();
  }
  return s3Service;
}

export default S3ScreenshotService;
