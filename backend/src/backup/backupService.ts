export type BackupType = 'full' | 'incremental';

export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface BackupLocation {
  region: string;
  storageUrl: string;
  isPrimary: boolean;
}

export interface BackupRecord {
  id: string;
  type: BackupType;
  status: BackupStatus;
  startedAt: Date;
  completedAt?: Date;
  sizeBytes?: number;
  encryptionAlgorithm: string;
  locations: BackupLocation[];
  checksum?: string;
  errorMessage?: string;
}

export const BACKUP_SCHEDULE = {
  fullIntervalHours: 6,
  incrementalIntervalHours: 1,
} as const;

export const ENCRYPTION_ALGORITHM = 'AES-256';

export class BackupService {
  createBackupRecord(type: BackupType, locations: BackupLocation[]): BackupRecord {
    return {
      id: `backup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      status: 'pending',
      startedAt: new Date(),
      encryptionAlgorithm: ENCRYPTION_ALGORITHM,
      locations,
    };
  }

  startBackup(record: BackupRecord): BackupRecord {
    return { ...record, status: 'in_progress' };
  }

  completeBackup(record: BackupRecord, sizeBytes: number, checksum: string): BackupRecord {
    return {
      ...record,
      status: 'completed',
      completedAt: new Date(),
      sizeBytes,
      checksum,
    };
  }

  failBackup(record: BackupRecord, errorMessage: string): BackupRecord {
    return {
      ...record,
      status: 'failed',
      completedAt: new Date(),
      errorMessage,
    };
  }

  isEncrypted(record: BackupRecord): boolean {
    return record.encryptionAlgorithm === ENCRYPTION_ALGORITHM;
  }

  getNextBackupTime(lastBackupTime: Date, type: BackupType): Date {
    const intervalHours =
      type === 'full'
        ? BACKUP_SCHEDULE.fullIntervalHours
        : BACKUP_SCHEDULE.incrementalIntervalHours;
    const next = new Date(lastBackupTime);
    next.setHours(next.getHours() + intervalHours);
    return next;
  }

  validateLocations(locations: BackupLocation[]): boolean {
    const regions = new Set(locations.map((l) => l.region));
    return regions.size >= 2;
  }
}
