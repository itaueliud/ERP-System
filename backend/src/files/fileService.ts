import { db } from '../database/connection';
import { storageClient } from '../services/storage';
import logger from '../utils/logger';
import crypto from 'crypto';

// Lazy-load sharp to avoid hard dependency at module load time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharpLib: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSharp(): Promise<any | null> {
  if (sharpLib !== null) return sharpLib;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sharpLib = require('sharp');
    return sharpLib;
  } catch {
    logger.warn('sharp not available — image processing will return original buffer');
    return null;
  }
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum file size: 50 MB (Requirement 22.2) */
export const MAX_FILE_SIZE = 52428800;

/** Allowed MIME types (Requirement 22.3) */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/gif',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Default pre-signed URL expiry: 1 hour (Requirement 22.9) */
export const DEFAULT_URL_EXPIRY = 3600;

// ============================================================================
// Interfaces
// ============================================================================

export interface UploadFileInput {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  uploadedBy: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  tags?: string[];
}

export interface StoredFile {
  id: string;
  fileId: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  entityType?: string;
  entityId?: string;
  uploadedBy: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
}

export interface ListFilesFilters {
  entityType?: string;
  entityId?: string;
  uploadedBy?: string;
  mimetype?: string;
  limit?: number;
  offset?: number;
}

export interface ScanResult {
  clean: boolean;
  threat?: string;
  scannedAt: Date;
}

export interface ImageProcessingResult {
  compressed: Buffer;
  thumbnail: Buffer;
  originalSize: number;
  compressedSize: number;
  thumbnailSize: number;
}

export interface ProcessImageUploadInput {
  buffer: Buffer;
  mimetype: string;
  quality?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

export interface StorageUsageStats {
  totalFiles: number;
  totalBytes: number;
  departmentId?: string;
}

export interface StorageUsageByEntityType {
  entityType: string;
  fileCount: number;
  totalBytes: number;
}

// ============================================================================
// FileStorageService
// ============================================================================

/**
 * File Storage Service
 * Handles file uploads, downloads, and management using S3/R2 storage.
 * Requirements: 22.1-22.12
 */
export class FileStorageService {
  /**
   * Validate file MIME type against allowed types.
   * Requirement 22.3: Validate file types before upload
   */
  validateFileType(mimetype: string): boolean {
    return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimetype);
  }

  /**
   * Validate file size against 50 MB limit.
   * Requirement 22.2: Support file uploads up to 50 MB
   */
  validateFileSize(size: number): boolean {
    return size > 0 && size <= MAX_FILE_SIZE;
  }

  /**
   * Scan file buffer for malware.
   * Requirement 22.6: Scan uploaded files for malware
   * Requirement 22.7: Quarantine and alert if malware detected
   *
   * This is a stub implementation. In production, integrate with a real
   * antivirus service (e.g., ClamAV, VirusTotal API, AWS Macie).
   */
  async scanForMalware(buffer: Buffer): Promise<ScanResult> {
    try {
      // Stub: In production, call an antivirus API here.
      // Example integration points:
      //   - ClamAV via clamdjs
      //   - VirusTotal API
      //   - AWS Macie
      //   - Cloudflare Gateway malware scanning

      logger.info('Malware scan completed (stub)', { bufferSize: buffer.length });

      return {
        clean: true,
        scannedAt: new Date(),
      };
    } catch (error) {
      logger.error('Malware scan failed', { error });
      // Fail safe: treat scan failure as potentially unsafe
      throw new Error('Malware scan failed. Upload rejected for safety.');
    }
  }

  /**
   * Generate a unique file identifier.
   * Requirement 22.5: Generate unique file identifier when file is uploaded
   */
  private generateFileId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Determine storage prefix based on entity type.
   * Requirement 22.8: Organize files by entity type
   */
  private getStoragePrefix(entityType?: string): string {
    const prefixMap: Record<string, string> = {
      contract: 'contracts',
      property_image: 'property_images',
      chat_attachment: 'chat_attachments',
      report: 'reports',
    };
    return prefixMap[entityType || ''] || 'files';
  }

  /**
   * Upload a file with validation and malware scanning.
   * Requirements: 22.1-22.8
   */
  async uploadFile(input: UploadFileInput): Promise<StoredFile> {
    // Validate file type (Requirement 22.3, 22.4)
    if (!this.validateFileType(input.mimetype)) {
      throw new Error(
        `Unsupported file type: ${input.mimetype}. Allowed types: PDF, DOCX, XLSX, PNG, JPG, JPEG, GIF`
      );
    }

    // Validate file size (Requirement 22.2)
    if (!this.validateFileSize(input.size)) {
      throw new Error(
        `File size ${input.size} bytes exceeds the 50 MB limit (${MAX_FILE_SIZE} bytes)`
      );
    }

    // Scan for malware (Requirement 22.6, 22.7)
    const scanResult = await this.scanForMalware(input.buffer);
    if (!scanResult.clean) {
      logger.warn('Malware detected in uploaded file', {
        filename: input.filename,
        threat: scanResult.threat,
        uploadedBy: input.uploadedBy,
      });
      throw new Error(`Malware detected: ${scanResult.threat}. File upload rejected.`);
    }

    // Generate unique file ID (Requirement 22.5)
    const fileId = this.generateFileId();
    const prefix = this.getStoragePrefix(input.entityType);
    const storageKey = storageClient.generateKey(input.filename, `${prefix}/${fileId}`);

    // Upload to S3/R2 (Requirement 22.1)
    let uploadBuffer = input.buffer;
    let uploadSize = input.size;

    // Auto-process images: compress + generate thumbnail (Requirements 22.11, 11.6)
    const isImage = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif'].includes(input.mimetype);
    if (isImage) {
      try {
        const processed = await this.processImageUpload({
          buffer: input.buffer,
          mimetype: input.mimetype,
        });
        uploadBuffer = processed.compressed;
        uploadSize = processed.compressedSize;

        // Upload thumbnail to a separate key
        const thumbKey = storageClient.generateKey(
          `thumb_${input.filename}`,
          `${prefix}/${fileId}/thumbnails`
        );
        await storageClient.upload({
          key: thumbKey,
          buffer: processed.thumbnail,
          contentType: input.mimetype === 'image/gif' ? 'image/png' : input.mimetype,
          metadata: {
            originalFilename: input.filename,
            uploadedBy: input.uploadedBy,
            type: 'thumbnail',
          },
        }).catch((err) => {
          logger.warn('Failed to upload thumbnail', { fileId, error: err });
        });

        logger.info('Image processed', {
          fileId,
          originalSize: processed.originalSize,
          compressedSize: processed.compressedSize,
          thumbnailSize: processed.thumbnailSize,
        });
      } catch (error) {
        logger.warn('Image processing failed, uploading original', { fileId, error });
      }
    }

    const uploadResult = await storageClient.upload({
      key: storageKey,
      buffer: uploadBuffer,
      contentType: input.mimetype,
      metadata: {
        originalFilename: input.filename,
        uploadedBy: input.uploadedBy,
        entityType: input.entityType || '',
        entityId: input.entityId || '',
      },
    });

    // Store metadata in database
    const result = await db.query(
      `INSERT INTO stored_files (
        file_id, filename, mimetype, size, url,
        entity_type, entity_id, uploaded_by, description, tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, file_id, filename, mimetype, size, url,
                entity_type, entity_id, uploaded_by, description, tags, created_at`,
      [
        fileId,
        input.filename,
        input.mimetype,
        uploadSize,
        uploadResult.url,
        input.entityType || null,
        input.entityId || null,
        input.uploadedBy,
        input.description || null,
        input.tags ? JSON.stringify(input.tags) : null,
      ]
    );

    logger.info('File uploaded successfully', {
      fileId,
      filename: input.filename,
      size: input.size,
      uploadedBy: input.uploadedBy,
    });

    return this.mapFileFromDb(result.rows[0]);
  }

  /**
   * Get file metadata by file ID.
   */
  async getFile(fileId: string): Promise<StoredFile | null> {
    const result = await db.query(
      `SELECT id, file_id, filename, mimetype, size, url,
              entity_type, entity_id, uploaded_by, description, tags, created_at
       FROM stored_files
       WHERE file_id = $1`,
      [fileId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapFileFromDb(result.rows[0]);
  }

  /**
   * Soft delete a file (mark as deleted by removing from DB, delete from storage).
   * Requirement 22.1: Manage file lifecycle
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Delete from storage
    try {
      // Reconstruct the storage key from the URL or re-derive it
      // Since we store the full URL, we need to find the key from the URL
      const prefix = this.getStoragePrefix(file.entityType);
      const storageKey = storageClient.generateKey(file.filename, `${prefix}/${fileId}`);
      await storageClient.delete(storageKey);
    } catch (error) {
      logger.warn('Failed to delete file from storage, removing DB record anyway', {
        fileId,
        error,
      });
    }

    // Remove from database
    await db.query('DELETE FROM stored_files WHERE file_id = $1', [fileId]);

    logger.info('File deleted', { fileId, deletedBy: userId });
  }

  /**
   * Generate a pre-signed download URL.
   * Requirement 22.9: Generate pre-signed URLs with 1-hour expiration
   */
  async getDownloadUrl(fileId: string, expiresIn: number = DEFAULT_URL_EXPIRY): Promise<string> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Derive storage key from file metadata
    const prefix = this.getStoragePrefix(file.entityType);
    const storageKey = storageClient.generateKey(file.filename, `${prefix}/${fileId}`);

    const url = await storageClient.getSignedDownloadUrl(storageKey, expiresIn);

    logger.info('Generated download URL', { fileId, expiresIn });

    return url;
  }

  /**
   * List files with optional filters.
   */
  async listFiles(filters: ListFilesFilters = {}): Promise<{ files: StoredFile[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      values.push(filters.entityType);
    }

    if (filters.entityId) {
      conditions.push(`entity_id = $${paramIndex++}`);
      values.push(filters.entityId);
    }

    if (filters.uploadedBy) {
      conditions.push(`uploaded_by = $${paramIndex++}`);
      values.push(filters.uploadedBy);
    }

    if (filters.mimetype) {
      conditions.push(`mimetype = $${paramIndex++}`);
      values.push(filters.mimetype);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM stored_files ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const dataValues = [...values, limit, offset];
    const result = await db.query(
      `SELECT id, file_id, filename, mimetype, size, url,
              entity_type, entity_id, uploaded_by, description, tags, created_at
       FROM stored_files
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataValues
    );

    return {
      files: result.rows.map((row) => this.mapFileFromDb(row)),
      total,
    };
  }

  /**
   * Compress an image buffer using sharp.
   * Requirement 22.11: Compress images to reduce storage costs while maintaining quality
   */
  async compressImage(buffer: Buffer, mimetype: string, quality = 80): Promise<Buffer> {
    const sharp = await getSharp();
    if (!sharp) {
      logger.warn('sharp unavailable, returning original buffer for compressImage');
      return buffer;
    }

    try {
      let pipeline = sharp(buffer);

      if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
        pipeline = pipeline.jpeg({ quality });
      } else if (mimetype === 'image/png') {
        pipeline = pipeline.png({ quality });
      } else if (mimetype === 'image/gif') {
        // GIF: convert to PNG for compression
        pipeline = pipeline.png({ quality });
      } else {
        // Fallback: convert to jpeg
        pipeline = pipeline.jpeg({ quality });
      }

      return await pipeline.toBuffer();
    } catch (error) {
      logger.warn('Image compression failed, returning original buffer', { error });
      return buffer;
    }
  }

  /**
   * Generate a thumbnail from an image buffer.
   * Requirement 11.6: Generate thumbnail images at 300x200 pixels for listing previews
   */
  async generateThumbnail(
    buffer: Buffer,
    mimetype: string,
    width = 300,
    height = 200
  ): Promise<Buffer> {
    const sharp = await getSharp();
    if (!sharp) {
      logger.warn('sharp unavailable, returning original buffer for generateThumbnail');
      return buffer;
    }

    try {
      let pipeline = sharp(buffer).resize(width, height, { fit: 'cover', position: 'centre' });

      if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
        pipeline = pipeline.jpeg({ quality: 80 });
      } else if (mimetype === 'image/png') {
        pipeline = pipeline.png({ quality: 80 });
      } else {
        pipeline = pipeline.jpeg({ quality: 80 });
      }

      return await pipeline.toBuffer();
    } catch (error) {
      logger.warn('Thumbnail generation failed, returning original buffer', { error });
      return buffer;
    }
  }

  /**
   * Process an image upload: compress + generate thumbnail.
   * Requirement 22.11: Compress images; 11.6: Generate thumbnails
   */
  async processImageUpload(input: ProcessImageUploadInput): Promise<ImageProcessingResult> {
    const { buffer, mimetype, quality = 80, thumbnailWidth = 300, thumbnailHeight = 200 } = input;

    const [compressed, thumbnail] = await Promise.all([
      this.compressImage(buffer, mimetype, quality),
      this.generateThumbnail(buffer, mimetype, thumbnailWidth, thumbnailHeight),
    ]);

    return {
      compressed,
      thumbnail,
      originalSize: buffer.length,
      compressedSize: compressed.length,
      thumbnailSize: thumbnail.length,
    };
  }

  /**
   * Get storage usage statistics, optionally filtered by department.
   * Requirement 22.12: Track storage usage per department
   */
  async getStorageUsage(departmentId?: string): Promise<StorageUsageStats> {
    let query: string;
    let values: any[];

    if (departmentId) {
      query = `
        SELECT COUNT(*) AS total_files, COALESCE(SUM(size), 0) AS total_bytes
        FROM stored_files
        WHERE department_id = $1
      `;
      values = [departmentId];
    } else {
      query = `
        SELECT COUNT(*) AS total_files, COALESCE(SUM(size), 0) AS total_bytes
        FROM stored_files
      `;
      values = [];
    }

    const result = await db.query(query, values);
    const row = result.rows[0];

    return {
      totalFiles: parseInt(row.total_files, 10),
      totalBytes: parseInt(row.total_bytes, 10),
      departmentId,
    };
  }

  /**
   * Get storage usage breakdown by entity type.
   * Requirement 22.12: Track storage usage per department and display on admin dashboard
   */
  async getStorageUsageByEntityType(): Promise<StorageUsageByEntityType[]> {
    const result = await db.query(`
      SELECT
        COALESCE(entity_type, 'uncategorized') AS entity_type,
        COUNT(*) AS file_count,
        COALESCE(SUM(size), 0) AS total_bytes
      FROM stored_files
      GROUP BY entity_type
      ORDER BY total_bytes DESC
    `);

    return result.rows.map((row: any) => ({
      entityType: row.entity_type,
      fileCount: parseInt(row.file_count, 10),
      totalBytes: parseInt(row.total_bytes, 10),
    }));
  }

  /**
   * Get the thumbnail URL for a file (if a thumbnail was stored).
   * Returns the pre-signed URL for the thumbnail variant.
   */
  async getThumbnailUrl(fileId: string, expiresIn: number = DEFAULT_URL_EXPIRY): Promise<string> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const prefix = this.getStoragePrefix(file.entityType);
    const thumbnailKey = storageClient.generateKey(
      `thumb_${file.filename}`,
      `${prefix}/${fileId}/thumbnails`
    );

    // Check if thumbnail exists; fall back to the original download URL
    const exists = await storageClient.exists(thumbnailKey).catch(() => false);
    if (!exists) {
      return this.getDownloadUrl(fileId, expiresIn);
    }

    return storageClient.getSignedDownloadUrl(thumbnailKey, expiresIn);
  }

  /**
   * Map a database row to a StoredFile object.
   */
  private mapFileFromDb(row: any): StoredFile {
    return {
      id: row.id,
      fileId: row.file_id,
      filename: row.filename,
      mimetype: row.mimetype,
      size: parseInt(row.size),
      url: row.url,
      entityType: row.entity_type || undefined,
      entityId: row.entity_id || undefined,
      uploadedBy: row.uploaded_by,
      description: row.description || undefined,
      tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : undefined,
      createdAt: row.created_at,
    };
  }
}

export const fileStorageService = new FileStorageService();
export default fileStorageService;
