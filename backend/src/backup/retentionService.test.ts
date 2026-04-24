import { RetentionService, DEFAULT_RETENTION_POLICY, BackupOperationLog } from './retentionService';
import { BackupRecord, BackupLocation } from './backupService';

const service = new RetentionService();

const locations: BackupLocation[] = [
  { region: 'us-east-1', storageUrl: 's3://bucket-us/backups', isPrimary: true },
];

function makeBackup(
  type: BackupRecord['type'],
  startedAt: Date,
  status: BackupRecord['status'] = 'completed'
): BackupRecord {
  return {
    id: `backup-${Math.random().toString(36).slice(2, 9)}`,
    type,
    status,
    startedAt,
    completedAt: new Date(startedAt.getTime() + 60000),
    encryptionAlgorithm: 'AES-256',
    locations,
  };
}

function makeLog(
  operation: BackupOperationLog['operation'],
  status: BackupOperationLog['status'],
  timestamp: Date
): BackupOperationLog {
  return {
    id: `log-${Math.random().toString(36).slice(2, 9)}`,
    backupId: 'backup-123',
    operation,
    status,
    timestamp,
    details: 'test log',
  };
}

const now = new Date('2024-06-01T12:00:00Z');

describe('RetentionService', () => {
  describe('getBackupsToDelete', () => {
    it('returns incremental backups older than 30 days', () => {
      const old = makeBackup('incremental', new Date('2024-04-01T00:00:00Z')); // 61 days ago
      const result = service.getBackupsToDelete([old], DEFAULT_RETENTION_POLICY, now);
      expect(result).toContain(old);
    });

    it('keeps incremental backups within 30 days', () => {
      const recent = makeBackup('incremental', new Date('2024-05-20T00:00:00Z')); // 12 days ago
      const result = service.getBackupsToDelete([recent], DEFAULT_RETENTION_POLICY, now);
      expect(result).not.toContain(recent);
    });

    it('returns full backups taken on Sunday older than 90 days (weekly)', () => {
      // 2024-02-25 is a Sunday, ~97 days before 2024-06-01
      const sunday = makeBackup('full', new Date('2024-02-25T00:00:00Z'));
      expect(sunday.startedAt.getDay()).toBe(0); // confirm Sunday
      const result = service.getBackupsToDelete([sunday], DEFAULT_RETENTION_POLICY, now);
      expect(result).toContain(sunday);
    });

    it('keeps full backups taken on Sunday within 90 days (weekly)', () => {
      // 2024-03-31 is a Sunday, ~62 days before 2024-06-01
      const sunday = makeBackup('full', new Date('2024-03-31T00:00:00Z'));
      expect(sunday.startedAt.getDay()).toBe(0); // confirm Sunday
      const result = service.getBackupsToDelete([sunday], DEFAULT_RETENTION_POLICY, now);
      expect(result).not.toContain(sunday);
    });

    it('returns full backups taken on 1st of month older than 365 days (monthly)', () => {
      const monthly = makeBackup('full', new Date('2023-05-01T00:00:00Z')); // ~396 days ago
      expect(monthly.startedAt.getDate()).toBe(1);
      const result = service.getBackupsToDelete([monthly], DEFAULT_RETENTION_POLICY, now);
      expect(result).toContain(monthly);
    });

    it('keeps full backups taken on 1st of month within 365 days (monthly)', () => {
      const monthly = makeBackup('full', new Date('2023-07-01T00:00:00Z')); // ~335 days ago
      expect(monthly.startedAt.getDate()).toBe(1);
      const result = service.getBackupsToDelete([monthly], DEFAULT_RETENTION_POLICY, now);
      expect(result).not.toContain(monthly);
    });

    it('returns other full backups older than 30 days', () => {
      // 2024-04-15 is a Monday, not 1st of month
      const other = makeBackup('full', new Date('2024-04-15T00:00:00Z')); // 47 days ago
      expect(other.startedAt.getDay()).not.toBe(0);
      expect(other.startedAt.getDate()).not.toBe(1);
      const result = service.getBackupsToDelete([other], DEFAULT_RETENTION_POLICY, now);
      expect(result).toContain(other);
    });
  });

  describe('logOperation', () => {
    it('creates a log entry with correct fields', () => {
      const log = service.logOperation('backup-abc', 'create', 'success', 'Backup created');
      expect(log.backupId).toBe('backup-abc');
      expect(log.operation).toBe('create');
      expect(log.status).toBe('success');
      expect(log.details).toBe('Backup created');
      expect(log.id).toBeDefined();
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    it('creates a log entry for failure status', () => {
      const log = service.logOperation('backup-xyz', 'restore', 'failure', 'Restore failed');
      expect(log.status).toBe('failure');
      expect(log.operation).toBe('restore');
    });
  });

  describe('getFailedOperations', () => {
    it('returns only failed logs', () => {
      const logs: BackupOperationLog[] = [
        makeLog('create', 'success', now),
        makeLog('restore', 'failure', now),
        makeLog('delete', 'failure', now),
        makeLog('verify', 'success', now),
      ];
      const failed = service.getFailedOperations(logs);
      expect(failed).toHaveLength(2);
      expect(failed.every((l) => l.status === 'failure')).toBe(true);
    });

    it('returns empty array when no failures', () => {
      const logs: BackupOperationLog[] = [
        makeLog('create', 'success', now),
        makeLog('verify', 'success', now),
      ];
      expect(service.getFailedOperations(logs)).toHaveLength(0);
    });
  });

  describe('isRestorationTestDue', () => {
    it('returns true when no restore logs exist', () => {
      expect(service.isRestorationTestDue([], now)).toBe(true);
    });

    it('returns true when no successful restore test in the last 30 days', () => {
      const oldRestore = makeLog('restore', 'success', new Date('2024-04-01T00:00:00Z')); // 61 days ago
      expect(service.isRestorationTestDue([oldRestore], now)).toBe(true);
    });

    it('returns true when only failed restore tests exist in last 30 days', () => {
      const failedRestore = makeLog('restore', 'failure', new Date('2024-05-25T00:00:00Z')); // 7 days ago
      expect(service.isRestorationTestDue([failedRestore], now)).toBe(true);
    });

    it('returns false when a successful restore test exists within 30 days', () => {
      const recentRestore = makeLog('restore', 'success', new Date('2024-05-20T00:00:00Z')); // 12 days ago
      expect(service.isRestorationTestDue([recentRestore], now)).toBe(false);
    });

    it('returns false when restore test was done exactly 30 days ago', () => {
      const exactlyThirtyDays = makeLog('restore', 'success', new Date('2024-05-02T12:00:00Z')); // exactly 30 days ago
      expect(service.isRestorationTestDue([exactlyThirtyDays], now)).toBe(false);
    });
  });
});
