import {
  FileStorageService,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  DEFAULT_URL_EXPIRY,
} from './fileService';
import { db } from '../database/connection';
import { storageClient } from '../services/storage';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('../services/storage', () => ({
  storageClient: {
    generateKey: jest.fn(),
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    getMetadata: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
    getSignedUploadUrl: jest.fn(),
    listFiles: jest.fn(),
    exists: jest.fn(),
  },
}));
jest.mock('../config', () => ({
  config: {
    env: 'test',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
    storage: {
      provider: 's3',
      aws: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1', bucket: 'bucket' },
      r2: { accountId: '', accessKeyId: '', secretAccessKey: '', bucket: '' },
    },
  },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockStorageClient = storageClient as jest.Mocked<typeof storageClient>;

// ============================================================================
// Helpers
// ============================================================================

const makeBuffer = (size = 1024) => Buffer.alloc(size, 'a');

const mockDbFile = (overrides: Record<string, any> = {}) => ({
  id: 'uuid-1',
  file_id: 'abc123',
  filename: 'test.pdf',
  mimetype: 'application/pdf',
  size: '1024',
  url: 'https://bucket.s3.amazonaws.com/files/abc123/test.pdf',
  entity_type: null,
  entity_id: null,
  uploaded_by: 'user-1',
  description: null,
  tags: null,
  created_at: new Date('2024-01-01'),
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(() => {
    service = new FileStorageService();
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // validateFileType
  // --------------------------------------------------------------------------

  describe('validateFileType', () => {
    it('accepts all allowed MIME types', () => {
      for (const mime of ALLOWED_MIME_TYPES) {
        expect(service.validateFileType(mime)).toBe(true);
      }
    });

    it('rejects unsupported MIME types', () => {
      expect(service.validateFileType('text/plain')).toBe(false);
      expect(service.validateFileType('video/mp4')).toBe(false);
      expect(service.validateFileType('application/zip')).toBe(false);
      expect(service.validateFileType('')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // validateFileSize
  // --------------------------------------------------------------------------

  describe('validateFileSize', () => {
    it('accepts files within the 50 MB limit', () => {
      expect(service.validateFileSize(1)).toBe(true);
      expect(service.validateFileSize(1024)).toBe(true);
      expect(service.validateFileSize(MAX_FILE_SIZE)).toBe(true);
    });

    it('rejects files exceeding 50 MB', () => {
      expect(service.validateFileSize(MAX_FILE_SIZE + 1)).toBe(false);
      expect(service.validateFileSize(MAX_FILE_SIZE * 2)).toBe(false);
    });

    it('rejects zero or negative sizes', () => {
      expect(service.validateFileSize(0)).toBe(false);
      expect(service.validateFileSize(-1)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // scanForMalware
  // --------------------------------------------------------------------------

  describe('scanForMalware', () => {
    it('returns clean result for normal buffers', async () => {
      const result = await service.scanForMalware(makeBuffer());
      expect(result.clean).toBe(true);
      expect(result.scannedAt).toBeInstanceOf(Date);
    });
  });

  // --------------------------------------------------------------------------
  // uploadFile
  // --------------------------------------------------------------------------

  describe('uploadFile', () => {
    const validInput = {
      filename: 'document.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: makeBuffer(1024),
      uploadedBy: 'user-1',
    };

    beforeEach(() => {
      mockStorageClient.generateKey.mockReturnValue('files/abc123/document.pdf');
      mockStorageClient.upload.mockResolvedValue({
        key: 'files/abc123/document.pdf',
        url: 'https://bucket.s3.amazonaws.com/files/abc123/document.pdf',
        size: 1024,
        etag: '"etag"',
      });
      mockDb.query.mockResolvedValue({
        rows: [mockDbFile()],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });
    });

    it('uploads a valid PDF file and returns stored file metadata', async () => {
      const result = await service.uploadFile(validInput);

      expect(mockStorageClient.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'application/pdf',
          buffer: validInput.buffer,
        })
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stored_files'),
        expect.any(Array)
      );
      expect(result.filename).toBe('test.pdf');
      expect(result.uploadedBy).toBe('user-1');
    });

    it('rejects unsupported file types', async () => {
      await expect(
        service.uploadFile({ ...validInput, mimetype: 'text/plain' })
      ).rejects.toThrow('Unsupported file type');
    });

    it('rejects files exceeding 50 MB', async () => {
      await expect(
        service.uploadFile({ ...validInput, size: MAX_FILE_SIZE + 1 })
      ).rejects.toThrow('exceeds the 50 MB limit');
    });

    it('stores entity type and entity ID when provided', async () => {
      await service.uploadFile({
        ...validInput,
        entityType: 'contract',
        entityId: 'contract-uuid',
      });

      const insertCall = mockDb.query.mock.calls[0];
      const params = insertCall[1] as any[];
      // entityType is at index 5, entityId at index 6
      expect(params[5]).toBe('contract');
      expect(params[6]).toBe('contract-uuid');
    });

    it('accepts all allowed MIME types', async () => {
      for (const mime of ALLOWED_MIME_TYPES) {
        jest.clearAllMocks();
        mockStorageClient.generateKey.mockReturnValue('files/abc123/file');
        mockStorageClient.upload.mockResolvedValue({
          key: 'files/abc123/file',
          url: 'https://example.com/file',
          size: 1024,
          etag: '"etag"',
        });
        mockDb.query.mockResolvedValue({
          rows: [mockDbFile({ mimetype: mime })],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

        await expect(
          service.uploadFile({ ...validInput, mimetype: mime })
        ).resolves.toBeDefined();
      }
    });
  });

  // --------------------------------------------------------------------------
  // getFile
  // --------------------------------------------------------------------------

  describe('getFile', () => {
    it('returns file metadata for a valid file ID', async () => {
      mockDb.query.mockResolvedValue({
        rows: [mockDbFile()],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await service.getFile('abc123');

      expect(result).not.toBeNull();
      expect(result!.fileId).toBe('abc123');
      expect(result!.filename).toBe('test.pdf');
    });

    it('returns null for a non-existent file ID', async () => {
      mockDb.query.mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await service.getFile('nonexistent');
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // deleteFile
  // --------------------------------------------------------------------------

  describe('deleteFile', () => {
    it('deletes an existing file', async () => {
      // First call: getFile
      mockDb.query
        .mockResolvedValueOnce({
          rows: [mockDbFile()],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        // Second call: DELETE
        .mockResolvedValueOnce({
          rows: [],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      mockStorageClient.delete.mockResolvedValue(undefined);

      await expect(service.deleteFile('abc123', 'user-1')).resolves.not.toThrow();
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM stored_files WHERE file_id = $1',
        ['abc123']
      );
    });

    it('throws when file is not found', async () => {
      mockDb.query.mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      await expect(service.deleteFile('nonexistent', 'user-1')).rejects.toThrow('File not found');
    });
  });

  // --------------------------------------------------------------------------
  // getDownloadUrl
  // --------------------------------------------------------------------------

  describe('getDownloadUrl', () => {
    it('returns a pre-signed URL for an existing file', async () => {
      mockDb.query.mockResolvedValue({
        rows: [mockDbFile()],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      mockStorageClient.generateKey.mockReturnValue('files/abc123/test.pdf');
      mockStorageClient.getSignedDownloadUrl.mockResolvedValue(
        'https://bucket.s3.amazonaws.com/files/abc123/test.pdf?X-Amz-Signature=sig'
      );

      const url = await service.getDownloadUrl('abc123');

      expect(url).toContain('https://');
      expect(mockStorageClient.getSignedDownloadUrl).toHaveBeenCalledWith(
        expect.any(String),
        DEFAULT_URL_EXPIRY
      );
    });

    it('uses custom expiry when provided', async () => {
      mockDb.query.mockResolvedValue({
        rows: [mockDbFile()],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      mockStorageClient.generateKey.mockReturnValue('files/abc123/test.pdf');
      mockStorageClient.getSignedDownloadUrl.mockResolvedValue('https://example.com/signed');

      await service.getDownloadUrl('abc123', 7200);

      expect(mockStorageClient.getSignedDownloadUrl).toHaveBeenCalledWith(
        expect.any(String),
        7200
      );
    });

    it('throws when file is not found', async () => {
      mockDb.query.mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      await expect(service.getDownloadUrl('nonexistent')).rejects.toThrow('File not found');
    });
  });

  // --------------------------------------------------------------------------
  // listFiles
  // --------------------------------------------------------------------------

  describe('listFiles', () => {
    it('returns all files when no filters are provided', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ count: '2' }],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [mockDbFile({ file_id: 'f1' }), mockDbFile({ file_id: 'f2' })],
          command: '',
          rowCount: 2,
          oid: 0,
          fields: [],
        });

      const result = await service.listFiles();

      expect(result.total).toBe(2);
      expect(result.files).toHaveLength(2);
    });

    it('filters by entityType and entityId', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [mockDbFile({ entity_type: 'contract', entity_id: 'contract-1' })],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        });

      const result = await service.listFiles({ entityType: 'contract', entityId: 'contract-1' });

      expect(result.total).toBe(1);
      expect(result.files[0].entityType).toBe('contract');
    });

    it('returns empty list when no files match', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
          command: '',
          rowCount: 1,
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [],
          command: '',
          rowCount: 0,
          oid: 0,
          fields: [],
        });

      const result = await service.listFiles({ entityType: 'nonexistent' });

      expect(result.total).toBe(0);
      expect(result.files).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // compressImage
  // --------------------------------------------------------------------------

  describe('compressImage', () => {
    it('returns original buffer when sharp is unavailable', async () => {
      // sharp is not installed in test env, so it falls back to original
      const buffer = makeBuffer(2048);
      const result = await service.compressImage(buffer, 'image/jpeg');
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a buffer for PNG mimetype', async () => {
      const buffer = makeBuffer(1024);
      const result = await service.compressImage(buffer, 'image/png', 70);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('returns a buffer for GIF mimetype', async () => {
      const buffer = makeBuffer(512);
      const result = await service.compressImage(buffer, 'image/gif');
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  // --------------------------------------------------------------------------
  // generateThumbnail
  // --------------------------------------------------------------------------

  describe('generateThumbnail', () => {
    it('returns a buffer for JPEG mimetype', async () => {
      const buffer = makeBuffer(2048);
      const result = await service.generateThumbnail(buffer, 'image/jpeg');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('returns a buffer with custom dimensions', async () => {
      const buffer = makeBuffer(1024);
      const result = await service.generateThumbnail(buffer, 'image/png', 150, 100);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('uses default 300x200 dimensions', async () => {
      const buffer = makeBuffer(1024);
      // Just verify it returns a buffer without throwing
      const result = await service.generateThumbnail(buffer, 'image/jpeg');
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  // --------------------------------------------------------------------------
  // processImageUpload
  // --------------------------------------------------------------------------

  describe('processImageUpload', () => {
    it('returns compressed and thumbnail buffers', async () => {
      const buffer = makeBuffer(4096);
      const result = await service.processImageUpload({ buffer, mimetype: 'image/jpeg' });

      expect(result.compressed).toBeInstanceOf(Buffer);
      expect(result.thumbnail).toBeInstanceOf(Buffer);
      expect(result.originalSize).toBe(4096);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.thumbnailSize).toBeGreaterThan(0);
    });

    it('uses custom quality and dimensions', async () => {
      const buffer = makeBuffer(2048);
      const result = await service.processImageUpload({
        buffer,
        mimetype: 'image/png',
        quality: 60,
        thumbnailWidth: 150,
        thumbnailHeight: 100,
      });

      expect(result.compressed).toBeInstanceOf(Buffer);
      expect(result.thumbnail).toBeInstanceOf(Buffer);
    });
  });

  // --------------------------------------------------------------------------
  // getStorageUsage
  // --------------------------------------------------------------------------

  describe('getStorageUsage', () => {
    it('returns overall storage stats when no departmentId provided', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ total_files: '42', total_bytes: '1048576' }],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await service.getStorageUsage();

      expect(result.totalFiles).toBe(42);
      expect(result.totalBytes).toBe(1048576);
      expect(result.departmentId).toBeUndefined();
    });

    it('filters by departmentId when provided', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ total_files: '10', total_bytes: '204800' }],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await service.getStorageUsage('dept-1');

      expect(result.totalFiles).toBe(10);
      expect(result.totalBytes).toBe(204800);
      expect(result.departmentId).toBe('dept-1');

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall[1]).toEqual(['dept-1']);
    });

    it('returns zeros when no files exist', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ total_files: '0', total_bytes: '0' }],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      const result = await service.getStorageUsage();

      expect(result.totalFiles).toBe(0);
      expect(result.totalBytes).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // getStorageUsageByEntityType
  // --------------------------------------------------------------------------

  describe('getStorageUsageByEntityType', () => {
    it('returns breakdown by entity type', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { entity_type: 'contracts', file_count: '5', total_bytes: '512000' },
          { entity_type: 'property_images', file_count: '20', total_bytes: '2048000' },
          { entity_type: 'uncategorized', file_count: '3', total_bytes: '30720' },
        ],
        command: '',
        rowCount: 3,
        oid: 0,
        fields: [],
      });

      const result = await service.getStorageUsageByEntityType();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ entityType: 'contracts', fileCount: 5, totalBytes: 512000 });
      expect(result[1]).toEqual({ entityType: 'property_images', fileCount: 20, totalBytes: 2048000 });
      expect(result[2]).toEqual({ entityType: 'uncategorized', fileCount: 3, totalBytes: 30720 });
    });

    it('returns empty array when no files exist', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      const result = await service.getStorageUsageByEntityType();
      expect(result).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // getThumbnailUrl
  // --------------------------------------------------------------------------

  describe('getThumbnailUrl', () => {
    it('returns thumbnail URL when thumbnail exists', async () => {
      mockDb.query.mockResolvedValue({
        rows: [mockDbFile({ entity_type: 'property_image' })],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      mockStorageClient.generateKey.mockReturnValue('property_images/abc123/thumbnails/thumb_test.pdf');
      mockStorageClient.exists.mockResolvedValue(true);
      mockStorageClient.getSignedDownloadUrl.mockResolvedValue(
        'https://bucket.s3.amazonaws.com/thumbnails/thumb_test.pdf?sig=abc'
      );

      const url = await service.getThumbnailUrl('abc123');

      expect(url).toContain('https://');
      expect(mockStorageClient.exists).toHaveBeenCalled();
      expect(mockStorageClient.getSignedDownloadUrl).toHaveBeenCalled();
    });

    it('falls back to original download URL when thumbnail does not exist', async () => {
      mockDb.query.mockResolvedValue({
        rows: [mockDbFile()],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      mockStorageClient.generateKey.mockReturnValue('files/abc123/test.pdf');
      mockStorageClient.exists.mockResolvedValue(false);
      mockStorageClient.getSignedDownloadUrl.mockResolvedValue(
        'https://bucket.s3.amazonaws.com/files/abc123/test.pdf?sig=xyz'
      );

      const url = await service.getThumbnailUrl('abc123');

      expect(url).toContain('https://');
    });

    it('throws when file is not found', async () => {
      mockDb.query.mockResolvedValue({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      await expect(service.getThumbnailUrl('nonexistent')).rejects.toThrow('File not found');
    });
  });

  // --------------------------------------------------------------------------
  // uploadFile — image auto-processing
  // --------------------------------------------------------------------------

  describe('uploadFile image auto-processing', () => {
    const imageInput = {
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
      buffer: makeBuffer(2048),
      uploadedBy: 'user-1',
      entityType: 'property_image',
    };

    beforeEach(() => {
      mockStorageClient.generateKey.mockReturnValue('property_images/abc123/photo.jpg');
      mockStorageClient.upload.mockResolvedValue({
        key: 'property_images/abc123/photo.jpg',
        url: 'https://bucket.s3.amazonaws.com/property_images/abc123/photo.jpg',
        size: 2048,
        etag: '"etag"',
      });
      mockDb.query.mockResolvedValue({
        rows: [mockDbFile({ mimetype: 'image/jpeg', entity_type: 'property_image' })],
        command: '',
        rowCount: 1,
        oid: 0,
        fields: [],
      });
    });

    it('calls upload at least once for image files', async () => {
      const result = await service.uploadFile(imageInput);
      expect(mockStorageClient.upload).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('stores entity type as property_image', async () => {
      await service.uploadFile(imageInput);
      const insertCall = mockDb.query.mock.calls.find((c) =>
        (c[0] as string).includes('INSERT INTO stored_files')
      );
      expect(insertCall).toBeDefined();
      const params = insertCall![1] as any[];
      expect(params[5]).toBe('property_image');
    });
  });
});
