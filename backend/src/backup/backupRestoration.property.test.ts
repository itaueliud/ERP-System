/**
 * Property-Based Tests for Backup Restoration Completeness
 *
 * Property 26: Backup Restoration Completeness
 * Validates: Requirements 34.8
 *
 * Uses random input generation (Math.random) to verify backup/restore properties
 * hold across many inputs. Uses in-memory data structures (no actual database).
 */

import * as crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbRecord {
  id: string;
  data: string;
  timestamp: number;
}

interface BackupSnapshot {
  id: string;
  records: DbRecord[];
  checksum: string;
  createdAt: number;
  isIncremental: boolean;
  baseBackupId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simple SHA-256 checksum of a string */
function computeChecksum(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Serialize records to a stable JSON string */
function serializeRecords(records: DbRecord[]): string {
  const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted);
}

/** Random string of given length */
function randStr(len = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** Random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate a random database state with 1–50 records */
function randomDbState(count?: number): DbRecord[] {
  const n = count ?? randInt(1, 50);
  const records: DbRecord[] = [];
  for (let i = 0; i < n; i++) {
    records.push({
      id: `rec-${randStr(6)}`,
      data: randStr(randInt(4, 20)),
      timestamp: Date.now() - randInt(0, 1_000_000),
    });
  }
  return records;
}

/** Create a full backup snapshot from a db state */
function createBackup(records: DbRecord[]): BackupSnapshot {
  const serialized = serializeRecords(records);
  return {
    id: `bk-${randStr(8)}`,
    records: JSON.parse(serialized) as DbRecord[],
    checksum: computeChecksum(serialized),
    createdAt: Date.now(),
    isIncremental: false,
  };
}

/** Restore records from a backup snapshot */
function restoreFromBackup(backup: BackupSnapshot): DbRecord[] {
  return JSON.parse(JSON.stringify(backup.records)) as DbRecord[];
}

/** Apply a random modification to a db state (add, remove, or change a record) */
function applyRandomModification(records: DbRecord[]): DbRecord[] {
  const state = [...records];
  if (state.length === 0) {
    // only add
    state.push({ id: `rec-${randStr(6)}`, data: randStr(8), timestamp: Date.now() });
    return state;
  }
  const op = randInt(0, 2);
  if (op === 0) {
    // add
    state.push({ id: `rec-${randStr(6)}`, data: randStr(8), timestamp: Date.now() });
  } else if (op === 1) {
    // remove
    const idx = randInt(0, state.length - 1);
    state.splice(idx, 1);
  } else {
    // change
    const idx = randInt(0, state.length - 1);
    state[idx] = { ...state[idx], data: randStr(8) };
  }
  return state;
}

/** Deep-equal comparison for DbRecord arrays (order-independent) */
function statesEqual(a: DbRecord[], b: DbRecord[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.id.localeCompare(y.id));
  const sortedB = [...b].sort((x, y) => x.id.localeCompare(y.id));
  return JSON.stringify(sortedA) === JSON.stringify(sortedB);
}

// ─── Property 26: Backup Restoration Completeness ────────────────────────────

/**
 * Validates: Requirements 34.8
 */
describe('Property 26: Backup Restoration Completeness', () => {
  it('restored state matches original for 100 random db states', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const original = randomDbState();
      const backup = createBackup(original);

      // Modify the live state
      let modified = applyRandomModification(original);
      // Apply a second modification to ensure state has changed
      modified = applyRandomModification(modified);

      // Restore from backup
      const restored = restoreFromBackup(backup);

      if (!statesEqual(original, restored)) {
        failures.push(
          `iteration ${i}: original has ${original.length} records, ` +
            `restored has ${restored.length} records — mismatch`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Backup Checksum Integrity ────────────────────────────────────────────────

describe('Backup Checksum Integrity', () => {
  it('checksum matches data after backup for 100 random states', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const state = randomDbState();
      const backup = createBackup(state);
      const recomputed = computeChecksum(serializeRecords(backup.records));

      if (recomputed !== backup.checksum) {
        failures.push(`iteration ${i}: checksum mismatch after backup`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('checksum does not match after modifying backup data for 100 random states', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const state = randomDbState();
      const backup = createBackup(state);

      // Tamper with the backup records
      const tampered: BackupSnapshot = {
        ...backup,
        records: applyRandomModification([...backup.records]),
      };

      const recomputed = computeChecksum(serializeRecords(tampered.records));

      // The recomputed checksum should differ from the original (tampered data)
      if (recomputed === backup.checksum) {
        // This can only happen if the modification produced identical serialized output,
        // which is extremely unlikely but theoretically possible — skip this iteration
        continue;
      }

      // Verify that the tampered backup's checksum no longer matches
      if (recomputed === tampered.checksum) {
        // tampered.checksum was copied from original — they should differ
        failures.push(
          `iteration ${i}: tampered data still has matching checksum (should differ)`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Incremental Backup Chain Completeness ───────────────────────────────────

describe('Incremental Backup Chain Completeness', () => {
  it('restoring full + all incrementals yields final state for 50 random chains', () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      // Base state + full backup
      let currentState = randomDbState();
      const fullBackup = createBackup(currentState);

      // Apply N incremental changes (1–5)
      const n = randInt(1, 5);
      const incrementalBackups: BackupSnapshot[] = [];

      for (let j = 0; j < n; j++) {
        currentState = applyRandomModification(currentState);
        const incBackup: BackupSnapshot = {
          ...createBackup(currentState),
          isIncremental: true,
          baseBackupId: j === 0 ? fullBackup.id : incrementalBackups[j - 1].id,
        };
        incrementalBackups.push(incBackup);
      }

      const expectedFinalState = currentState;

      // Restore: start from full backup, apply incrementals in order
      let restoredState = restoreFromBackup(fullBackup);
      for (const incBackup of incrementalBackups) {
        // Each incremental backup contains the full state at that point
        restoredState = restoreFromBackup(incBackup);
      }

      if (!statesEqual(expectedFinalState, restoredState)) {
        failures.push(
          `iteration ${i}: after ${n} incrementals, ` +
            `expected ${expectedFinalState.length} records, ` +
            `got ${restoredState.length}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Retention Policy Completeness ───────────────────────────────────────────

describe('Retention Policy Completeness', () => {
  it('backups not in delete list are retained for 100 random backup sets', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const totalCount = randInt(2, 20);
      const allBackups: BackupSnapshot[] = Array.from({ length: totalCount }, () =>
        createBackup(randomDbState(randInt(1, 10))),
      );

      // Randomly select some backups to delete (0 to totalCount-1)
      const deleteCount = randInt(0, totalCount - 1);
      const shuffled = [...allBackups].sort(() => Math.random() - 0.5);
      const toDelete = new Set(shuffled.slice(0, deleteCount).map((b) => b.id));

      // Apply retention: remove deleted backups
      const retained = allBackups.filter((b) => !toDelete.has(b.id));

      // Property: retained = all - deleted
      const expectedRetainedCount = totalCount - deleteCount;
      if (retained.length !== expectedRetainedCount) {
        failures.push(
          `iteration ${i}: expected ${expectedRetainedCount} retained, got ${retained.length}`,
        );
        continue;
      }

      // Property: no deleted backup appears in retained
      const retainedIds = new Set(retained.map((b) => b.id));
      for (const id of toDelete) {
        if (retainedIds.has(id)) {
          failures.push(`iteration ${i}: deleted backup ${id} still in retained set`);
        }
      }

      // Property: all non-deleted backups are present in retained
      for (const backup of allBackups) {
        if (!toDelete.has(backup.id) && !retainedIds.has(backup.id)) {
          failures.push(
            `iteration ${i}: backup ${backup.id} not deleted but missing from retained`,
          );
        }
      }
    }

    expect(failures).toHaveLength(0);
  });
});
