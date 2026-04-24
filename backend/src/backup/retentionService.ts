import { BackupRecord } from './backupService';

export interface RetentionPolicy {
  dailyRetentionDays: number;
  weeklyRetentionDays: number;
  monthlyRetentionDays: number;
}

export interface BackupOperationLog {
  id: string;
  backupId: string;
  operation: 'create' | 'restore' | 'delete' | 'verify';
  status: 'success' | 'failure';
  timestamp: Date;
  details: string;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  dailyRetentionDays: 30,
  weeklyRetentionDays: 90,
  monthlyRetentionDays: 365,
};

export class RetentionService {
  /**
   * Returns backups that should be deleted based on the retention policy.
   * - Incremental backups: delete if older than dailyRetentionDays
   * - Weekly full backups (taken on Sundays): delete if older than weeklyRetentionDays
   * - Monthly full backups (taken on 1st of month): delete if older than monthlyRetentionDays
   * - Other full backups: delete if older than dailyRetentionDays
   */
  getBackupsToDelete(
    backups: BackupRecord[],
    policy: RetentionPolicy,
    now: Date
  ): BackupRecord[] {
    return backups.filter((backup) => {
      const ageMs = now.getTime() - backup.startedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (backup.type === 'incremental') {
        return ageDays > policy.dailyRetentionDays;
      }

      // full backup
      const day = backup.startedAt.getDate();
      const dayOfWeek = backup.startedAt.getDay(); // 0 = Sunday

      if (day === 1) {
        // monthly backup (1st of month)
        return ageDays > policy.monthlyRetentionDays;
      } else if (dayOfWeek === 0) {
        // weekly backup (Sunday)
        return ageDays > policy.weeklyRetentionDays;
      } else {
        // other full backups
        return ageDays > policy.dailyRetentionDays;
      }
    });
  }

  /**
   * Creates a log entry for a backup operation.
   */
  logOperation(
    backupId: string,
    operation: BackupOperationLog['operation'],
    status: BackupOperationLog['status'],
    details: string
  ): BackupOperationLog {
    return {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      backupId,
      operation,
      status,
      timestamp: new Date(),
      details,
    };
  }

  /**
   * Returns only the failed operations from a list of logs.
   */
  getFailedOperations(logs: BackupOperationLog[]): BackupOperationLog[] {
    return logs.filter((log) => log.status === 'failure');
  }

  /**
   * Returns true if no successful restore test has been performed in the last 30 days.
   */
  isRestorationTestDue(logs: BackupOperationLog[], now: Date): boolean {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentSuccessfulRestore = logs.find(
      (log) =>
        log.operation === 'restore' &&
        log.status === 'success' &&
        log.timestamp >= thirtyDaysAgo
    );
    return recentSuccessfulRestore === undefined;
  }
}
