import { StorageClient } from './client';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../config', () => ({
  config: {
    storage: {
      provider: 's3',
      aws: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        region: 'us-east-1',
        bucket: 'test-bucket',
      },
      r2: {
        accountId: 'test-account',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        bucket: 'test-bucket',
      },
    },
  },
}));

describe('StorageClient', () => {
  let client: StorageClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new StorageClient();
  });

  describe('generateKey', () => {
    it('should generate unique key with prefix', () => {
      const key1 = client.generateKey('document.pdf', 'contracts');
      const key2 = client.generateKey('document.pdf', 'contracts');

      expect(key1).toMatch(/^contracts\/\d+-[a-f0-9]{32}\.pdf$/);
      expect(key2).toMatch(/^contracts\/\d+-[a-f0-9]{32}\.pdf$/);
      expect(key1).not.toBe(key2);
    });

    it('should generate unique key without prefix', () => {
      const key = client.generateKey('image.png');

      expect(key).toMatch(/^\d+-[a-f0-9]{32}\.png$/);
    });

    it('should preserve file extension', () => {
      const key = client.generateKey('report.xlsx', 'reports');

      expect(key).toMatch(/\.xlsx$/);
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      jest.spyOn(client, 'getMetadata').mockResolvedValue({
        key: 'test.pdf',
        size: 1024,
        contentType: 'application/pdf',
        lastModified: new Date(),
        etag: 'etag-123',
      });

      const exists = await client.exists('test.pdf');

      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const error: any = new Error('Not Found');
      error.name = 'NotFound';
      jest.spyOn(client, 'getMetadata').mockRejectedValue(error);

      const exists = await client.exists('nonexistent.pdf');

      expect(exists).toBe(false);
    });
  });
});
