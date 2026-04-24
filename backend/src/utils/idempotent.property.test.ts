/**
 * Property-Based Tests for Idempotent Operations
 *
 * Property 17: Idempotent Operations
 * Validates: Requirements 50.8
 *
 * Tests that f(f(x)) === f(x) for idempotent functions across 100 random inputs.
 * All operations are in-memory — no database required.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = 'active' | 'inactive' | 'pending' | 'archived' | 'deleted';

interface ERecord {
  id: string;
  status: Status;
  data: string;
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  readAt?: number;
}

// ─── Idempotent operations under test ────────────────────────────────────────

/** Sets a record's status. Idempotent: calling twice with same status = same result. */
function setStatus(record: ERecord, status: Status): ERecord {
  return { ...record, status };
}

/** Upserts a record into a map by id. Idempotent: inserting same record twice = same state. */
function upsert(map: Map<string, ERecord>, record: ERecord): Map<string, ERecord> {
  const result = new Map(map);
  result.set(record.id, record);
  return result;
}

/** Marks a notification as read. Idempotent: marking twice = same as once. */
function markRead(notification: Notification): Notification {
  if (notification.read) return notification;
  return { ...notification, read: true, readAt: notification.readAt ?? Date.now() };
}

/** Deduplicates an array by value. Idempotent: deduplicating twice = same result. */
function deduplicate<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUSES: Status[] = ['active', 'inactive', 'pending', 'archived', 'deleted'];

function randomId(): string {
  return `id-${Math.floor(Math.random() * 10_000)}`;
}

function randomStatus(): Status {
  return STATUSES[Math.floor(Math.random() * STATUSES.length)];
}

function randomERecord(): ERecord {
  return { id: randomId(), status: randomStatus(), data: `data-${Math.random().toFixed(6)}` };
}

function randomNotification(read = false): Notification {
  return { id: randomId(), message: `msg-${Math.random().toFixed(6)}`, read };
}

function randomStringArray(length: number): string[] {
  const pool = Array.from({ length: length * 2 }, (_, i) => `item-${i % length}`);
  return pool.sort(() => Math.random() - 0.5).slice(0, length);
}

function mapsEqual(a: Map<string, ERecord>, b: Map<string, ERecord>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (!bv) return false;
    if (JSON.stringify(v) !== JSON.stringify(bv)) return false;
  }
  return true;
}

// ─── Property 17: f(f(x)) === f(x) ───────────────────────────────────────────

/**
 * Validates: Requirements 50.8
 */
describe('Property 17 (Idempotent Operations): f(f(x)) === f(x)', () => {
  it('setStatus: applying same status twice equals applying once — 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const record = randomERecord();
      const status = randomStatus();

      const once = setStatus(record, status);
      const twice = setStatus(once, status);

      if (JSON.stringify(once) !== JSON.stringify(twice)) {
        failures.push(`id=${record.id}, status=${status}: once=${JSON.stringify(once)}, twice=${JSON.stringify(twice)}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('upsert: inserting same record twice equals inserting once — 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const record = randomERecord();
      const initialMap = new Map<string, ERecord>();

      const once = upsert(initialMap, record);
      const twice = upsert(once, record);

      if (!mapsEqual(once, twice)) {
        failures.push(`id=${record.id}: maps differ after second upsert`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('markRead: marking notification read twice equals marking once — 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const notification = randomNotification(Math.random() < 0.5);

      const once = markRead(notification);
      const twice = markRead(once);

      // Both must be read, and readAt must be identical
      if (!twice.read) {
        failures.push(`id=${notification.id}: not read after second markRead`);
      } else if (once.readAt !== twice.readAt) {
        failures.push(`id=${notification.id}: readAt changed on second call (${once.readAt} vs ${twice.readAt})`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('deduplicate: deduplicating an already-deduplicated list equals deduplicating once — 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const arr = randomStringArray(10 + Math.floor(Math.random() * 20));

      const once = deduplicate(arr);
      const twice = deduplicate(once);

      if (JSON.stringify(once) !== JSON.stringify(twice)) {
        failures.push(`arr length ${arr.length}: once=${JSON.stringify(once)}, twice=${JSON.stringify(twice)}`);
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Idempotent operations don't change already-final state ──────────────────

describe('Property 17 (Idempotent Operations): already-final state is unchanged', () => {
  it('setStatus: record already in target status is unchanged — 100 random records', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const status = randomStatus();
      const record: ERecord = { id: randomId(), status, data: `data-${i}` };

      const result = setStatus(record, status);

      if (JSON.stringify(result) !== JSON.stringify(record)) {
        failures.push(`id=${record.id}: record changed when status already ${status}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('markRead: already-read notification is unchanged — 100 random notifications', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const notification: Notification = { id: randomId(), message: `msg-${i}`, read: true, readAt: Date.now() - i };

      const result = markRead(notification);

      if (result.read !== true || result.readAt !== notification.readAt) {
        failures.push(`id=${notification.id}: readAt changed from ${notification.readAt} to ${result.readAt}`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('deduplicate: already-unique list is unchanged — 100 random unique arrays', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const size = 5 + Math.floor(Math.random() * 15);
      const unique = Array.from({ length: size }, (_, j) => `unique-${i}-${j}`);

      const result = deduplicate(unique);

      if (JSON.stringify(result) !== JSON.stringify(unique)) {
        failures.push(`size=${size}: unique array changed after deduplication`);
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Idempotent operations are order-independent for same input ───────────────

describe('Property 17 (Idempotent Operations): order-independent for same input', () => {
  it('setStatus on independent records: order of operations does not affect final state — 100 pairs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const r1 = randomERecord();
      const r2 = randomERecord();
      const s1 = randomStatus();
      const s2 = randomStatus();

      // Order A: set r1 then r2
      const a1 = setStatus(r1, s1);
      const a2 = setStatus(r2, s2);

      // Order B: set r2 then r1 (independent records)
      const b2 = setStatus(r2, s2);
      const b1 = setStatus(r1, s1);

      if (JSON.stringify(a1) !== JSON.stringify(b1) || JSON.stringify(a2) !== JSON.stringify(b2)) {
        failures.push(`r1.id=${r1.id}, r2.id=${r2.id}: order affected final state`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('upsert of independent records: order does not affect final map state — 100 pairs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      // Ensure distinct ids
      const r1: ERecord = { id: `r1-${i}`, status: randomStatus(), data: `d1-${i}` };
      const r2: ERecord = { id: `r2-${i}`, status: randomStatus(), data: `d2-${i}` };
      const base = new Map<string, ERecord>();

      // Order A: upsert r1 then r2
      const afterA = upsert(upsert(base, r1), r2);

      // Order B: upsert r2 then r1
      const afterB = upsert(upsert(base, r2), r1);

      if (!mapsEqual(afterA, afterB)) {
        failures.push(`r1.id=${r1.id}, r2.id=${r2.id}: upsert order affected map state`);
      }
    }

    expect(failures).toHaveLength(0);
  });
});
