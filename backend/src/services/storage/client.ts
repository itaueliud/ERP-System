import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config';
import logger from '../../utils/logger';
import crypto from 'crypto';
import path from 'path';
import { withRetry } from '../../utils/retry';
import { CircuitBreaker } from '../../utils/circuitBreaker';
import metrics from '../../utils/metrics';

export interface UploadOptions {
  key: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  etag: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  metadata?: Record<string, string>;
}

export class StorageClient {
  private client: S3Client;
  private bucket: string;
  private provider: 's3' | 'r2';
  private circuitBreaker = new CircuitBreaker({ name: 'storage', failureThreshold: 5, timeout: 30000 });

  constructor() {
    this.provider = config.storage.provider;

    if (this.provider === 's3') {
      this.client = new S3Client({
        region: config.storage.aws.region,
        credentials: {
          accessKeyId: config.storage.aws.accessKeyId,
          secretAccessKey: config.storage.aws.secretAccessKey,
        },
      });
      this.bucket = config.storage.aws.bucket;
    } else {
      // Cloudflare R2 configuration
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.storage.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.storage.r2.accessKeyId,
          secretAccessKey: config.storage.r2.secretAccessKey,
        },
      });
      this.bucket = config.storage.r2.bucket;
    }

    logger.info(`Storage client initialized with provider: ${this.provider}`);
  }

  /**
   * Upload file to storage
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    return metrics.time('storage.upload', () =>
      this.circuitBreaker.execute(() =>
        withRetry(async () => {
          try {
            const command = new PutObjectCommand({
              Bucket: this.bucket,
              Key: options.key,
              Body: options.buffer,
              ContentType: options.contentType,
              Metadata: options.metadata,
            });
            const response = await this.client.send(command);
            const url = this.getPublicUrl(options.key);
            logger.info('File uploaded successfully', { key: options.key, size: options.buffer.length });
            return { key: options.key, url, size: options.buffer.length, etag: response.ETag || '' };
          } catch (error: any) {
            logger.error('Failed to upload file', { error, key: options.key });
            throw new Error(`Failed to upload file: ${error.message}`);
          }
        }, {}, 'storage.upload')
      )
    );
  }

  /**
   * Download file from storage
   */
  async download(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No file content received');
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      logger.info('File downloaded successfully', { key, size: buffer.length });

      return buffer;
    } catch (error: any) {
      logger.error('Failed to download file', { error, key });
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Delete file from storage
   */
  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);

      logger.info('File deleted successfully', { key });
    } catch (error: any) {
      logger.error('Failed to delete file', { error, key });
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string): Promise<FileMetadata> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        key,
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || '',
        metadata: response.Metadata,
      };
    } catch (error: any) {
      logger.error('Failed to get file metadata', { error, key });
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Generate pre-signed URL for download
   */
  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      logger.info('Generated signed download URL', { key, expiresIn });

      return url;
    } catch (error: any) {
      logger.error('Failed to generate signed URL', { error, key });
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Generate pre-signed URL for upload
   */
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      logger.info('Generated signed upload URL', { key, expiresIn });

      return url;
    } catch (error: any) {
      logger.error('Failed to generate signed upload URL', { error, key });
      throw new Error(`Failed to generate signed upload URL: ${error.message}`);
    }
  }

  /**
   * List files with prefix
   */
  async listFiles(prefix: string, maxKeys: number = 1000): Promise<FileMetadata[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.client.send(command);

      const files: FileMetadata[] = (response.Contents || []).map((item) => ({
        key: item.Key || '',
        size: item.Size || 0,
        contentType: 'application/octet-stream',
        lastModified: item.LastModified || new Date(),
        etag: item.ETag || '',
      }));

      logger.info('Listed files successfully', { prefix, count: files.length });

      return files;
    } catch (error: any) {
      logger.error('Failed to list files', { error, prefix });
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.getMetadata(key);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate unique file key
   */
  generateKey(originalFilename: string, prefix: string = ''): string {
    const ext = path.extname(originalFilename);
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const key = prefix ? `${prefix}/${timestamp}-${hash}${ext}` : `${timestamp}-${hash}${ext}`;
    return key;
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(key: string): string {
    if (this.provider === 's3') {
      return `https://${this.bucket}.s3.${config.storage.aws.region}.amazonaws.com/${key}`;
    } else {
      return `https://${this.bucket}.${config.storage.r2.accountId}.r2.cloudflarestorage.com/${key}`;
    }
  }
}

export const storageClient = new StorageClient();
