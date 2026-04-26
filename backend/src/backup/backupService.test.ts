import {
  BackupService,
  BackupLocation,
  ENCRYPTION_ALGORITHM,
  BACKUP_SCHEDULE,
} from './backupService';

const service = new BackupService();

const locations: BackupLocation[] = [
  { region: 'us-east-1', storageUrl: 's3://bucket-us/backups', isPrimary: true },
  { region: 'eu-west-1', storageUrl: 's3://bucket-eu/backups', isPrimary: false },
];

describe('BackupService', () => {
  describe('createBackupRecord', () => {
    it('creates a record with pending status', () => {
      const record = service.createBackupRecord('full', locations);
      expect(record.status).toBe('pending');
    });

    it('creates a record with AES-256 encryption', () => {
      const record = service.createBackupRecord('full', locations);
      expect(record.encryptionAlgorithm).toBe(ENCRYPTION_ALGORITHM);
    });

    it('creates a record with the given type and locations', () => {
      const record = service.createBackupRecord('incremental', locations);
      expect(record.type).toBe('incremental');
      expect(record.locations).toEqual(locations);
    });
  });

  describe('startBackup', () => {
    it('sets status to in_progress', () => {
      const record = service.createBackupRecord('full', locations);
      const started = service.startBackup(record);
      expect(started.status).toBe('in_progress');
    });
  });

  describe('completeBackup', () => {
    it('sets status to completed with size and checksum', () => {
      const record = service.startBackup(service.createBackupRecord('full', locations));
      const completed = service.completeBackup(record, 1024 * 1024, 'abc123');
      expect(completed.status).toBe('completed');
      expect(completed.sizeBytes).toBe(1024 * 1024);
      expect(completed.checksum).toBe('abc123');
      expect(completed.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('failBackup', () => {
    it('sets status to failed with error message', () => {
      const record = service.startBackup(service.createBackupRecord('full', locations));
      const failed = service.failBackup(record, 'Connection timeout');
      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe('Connection timeout');
    });
  });

  describe('isEncrypted', () => {
    it('returns true for AES-256 encrypted record', () => {
      const record = service.createBackupRecord('full', locations);
      expect(service.isEncrypted(record)).toBe(true);
    });

    it('returns false for non-AES-256 algorithm', () => {
      const record = { ...service.createBackupRecord('full', locations), encryptionAlgorithm: 'DES' };
      expect(service.isEncrypted(record)).toBe(false);
    });
  });

  describe('getNextBackupTime', () => {
    const base = new Date('2024-01-01T00:00:00Z');

    it('returns correct time for full backup (6 hours)', () => {
      const next = service.getNextBackupTime(base, 'full');
      const expected = new Date('2024-01-01T06:00:00Z');
      expect(next.getTime()).toBe(expected.getTime());
    });

    it('returns correct time for incremental backup (1 hour)', () => {
      const next = service.getNextBackupTime(base, 'incremental');
      const expected = new Date('2024-01-01T01:00:00Z');
      expect(next.getTime()).toBe(expected.getTime());
    });

    it('uses BACKUP_SCHEDULE constants', () => {
      const fullNext = service.getNextBackupTime(base, 'full');
      const incNext = service.getNextBackupTime(base, 'incremental');
      expect((fullNext.getTime() - base.getTime()) / 3600000).toBe(BACKUP_SCHEDULE.fullIntervalHours);
      expect((incNext.getTime() - base.getTime()) / 3600000).toBe(BACKUP_SCHEDULE.incrementalIntervalHours);
    });
  });

  describe('validateLocations', () => {
    it('returns true for 2+ different regions', () => {
      expect(service.validateLocations(locations)).toBe(true);
    });

    it('returns false for a single location', () => {
      expect(service.validateLocations([locations[0]])).toBe(false);
    });

    it('returns false for multiple locations in the same region', () => {
      const sameRegion: BackupLocation[] = [
        { region: 'us-east-1', storageUrl: 's3://bucket-a/backups', isPrimary: true },
        { region: 'us-east-1', storageUrl: 's3://bucket-b/backups', isPrimary: false },
      ];
      expect(service.validateLocations(sameRegion)).toBe(false);
    });
  });
});
