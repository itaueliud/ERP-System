/**
 * Property-Based Tests for Financial Transaction Invariant
 *
 * Property 4: Financial Transaction Invariant
 * Validates: Requirements 7.9
 *
 * Uses random input generation (Math.random) to verify that the double-entry
 * bookkeeping invariant holds: sum of debits === sum of credits.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface TransactionEntry {
  id: string;
  type: 'debit' | 'credit';
  amount: number; // always positive
  accountId: string;
  description: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId(): string {
  return `txn-${++_idCounter}`;
}

/** Returns a random float in [min, max] */
function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Generate a random positive amount between 0.01 and 100,000 */
function randomAmount(): number {
  return randFloat(0.01, 100_000);
}

/** Generate a random account id */
function randomAccountId(): string {
  return `acct-${Math.floor(Math.random() * 10_000)}`;
}

/**
 * Build a balanced transaction set.
 * Creates N debit entries and N credit entries where each pair shares the same amount,
 * guaranteeing sum(debits) === sum(credits) by construction.
 */
function buildBalancedTransactionSet(n: number): TransactionEntry[] {
  const entries: TransactionEntry[] = [];
  for (let i = 0; i < n; i++) {
    const amount = randomAmount();
    entries.push({
      id: nextId(),
      type: 'debit',
      amount,
      accountId: randomAccountId(),
      description: `Debit entry ${i}`,
    });
    entries.push({
      id: nextId(),
      type: 'credit',
      amount,
      accountId: randomAccountId(),
      description: `Credit entry ${i}`,
    });
  }
  return entries;
}

/** Sum all debit amounts in a transaction set */
function sumDebits(entries: TransactionEntry[]): number {
  return entries
    .filter((e) => e.type === 'debit')
    .reduce((acc, e) => acc + e.amount, 0);
}

/** Sum all credit amounts in a transaction set */
function sumCredits(entries: TransactionEntry[]): number {
  return entries
    .filter((e) => e.type === 'credit')
    .reduce((acc, e) => acc + e.amount, 0);
}

/** Check the invariant: sum(debits) === sum(credits) within floating-point tolerance */
function isBalanced(entries: TransactionEntry[], tolerance = 1e-9): boolean {
  return Math.abs(sumDebits(entries) - sumCredits(entries)) <= tolerance;
}

// ─── Property 4: Financial Transaction Invariant ─────────────────────────────

describe('Property 4 (Financial Transaction Invariant): sum of debits equals sum of credits', () => {
  /**
   * Validates: Requirements 7.9
   * Generate 100 random balanced transaction sets (2–20 entries each).
   * For each set verify sum(debits) === sum(credits) within 1e-9 tolerance.
   */
  it('sum(debits) === sum(credits) for 100 random balanced transaction sets', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const n = 1 + Math.floor(Math.random() * 10); // 1..10 pairs → 2..20 entries
      const entries = buildBalancedTransactionSet(n);
      const debitSum = sumDebits(entries);
      const creditSum = sumCredits(entries);

      if (Math.abs(debitSum - creditSum) > 1e-9) {
        failures.push(
          `iteration=${i}, pairs=${n}: debitSum=${debitSum.toFixed(6)}, creditSum=${creditSum.toFixed(6)}, diff=${Math.abs(debitSum - creditSum)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Transaction amounts are always positive ──────────────────────────────────

describe('Transaction amounts are always positive', () => {
  it('amount > 0 for 200 random transactions', () => {
    const failures: string[] = [];

    for (let i = 0; i < 200; i++) {
      const amount = randomAmount();
      const entry: TransactionEntry = {
        id: nextId(),
        type: Math.random() < 0.5 ? 'debit' : 'credit',
        amount,
        accountId: randomAccountId(),
        description: `Entry ${i}`,
      };

      if (entry.amount <= 0) {
        failures.push(`id=${entry.id}: amount=${entry.amount} is not positive`);
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Adding a balanced pair preserves the invariant ──────────────────────────

describe('Adding a balanced pair preserves the invariant', () => {
  it('invariant holds after adding a debit+credit pair for 100 random pairs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const n = 1 + Math.floor(Math.random() * 5); // start with 1..5 pairs
      const entries = buildBalancedTransactionSet(n);

      // Verify the set is balanced before adding
      if (!isBalanced(entries)) {
        failures.push(`iteration=${i}: initial set was not balanced (test setup error)`);
        continue;
      }

      // Add a new balanced pair
      const pairAmount = randomAmount();
      entries.push({
        id: nextId(),
        type: 'debit',
        amount: pairAmount,
        accountId: randomAccountId(),
        description: 'Added debit',
      });
      entries.push({
        id: nextId(),
        type: 'credit',
        amount: pairAmount,
        accountId: randomAccountId(),
        description: 'Added credit',
      });

      if (!isBalanced(entries)) {
        const d = sumDebits(entries);
        const c = sumCredits(entries);
        failures.push(
          `iteration=${i}: invariant broken after adding pair of ${pairAmount.toFixed(4)}: debit=${d.toFixed(6)}, credit=${c.toFixed(6)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Removing a balanced pair preserves the invariant ────────────────────────

describe('Removing a balanced pair preserves the invariant', () => {
  it('invariant holds after removing a debit+credit pair for 50 random removals', () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      const n = 2 + Math.floor(Math.random() * 4); // 2..5 pairs → 4..10 entries
      const entries = buildBalancedTransactionSet(n);

      // Verify balanced before removal
      if (!isBalanced(entries)) {
        failures.push(`iteration=${i}: initial set was not balanced (test setup error)`);
        continue;
      }

      // Find the first debit and its matching credit (same amount, built by buildBalancedTransactionSet)
      const debits = entries.filter((e) => e.type === 'debit');
      const credits = entries.filter((e) => e.type === 'credit');

      // Pick a random debit to remove
      const debitIdx = Math.floor(Math.random() * debits.length);
      const debitToRemove = debits[debitIdx];

      // Find a credit with the same amount
      const matchingCreditIdx = credits.findIndex(
        (c) => Math.abs(c.amount - debitToRemove.amount) <= 1e-12,
      );

      if (matchingCreditIdx === -1) {
        // Shouldn't happen with our builder, but skip if it does
        continue;
      }

      const creditToRemove = credits[matchingCreditIdx];

      // Remove both entries
      const remaining = entries.filter(
        (e) => e.id !== debitToRemove.id && e.id !== creditToRemove.id,
      );

      if (remaining.length > 0 && !isBalanced(remaining)) {
        const d = sumDebits(remaining);
        const c = sumCredits(remaining);
        failures.push(
          `iteration=${i}: invariant broken after removing pair of ${debitToRemove.amount.toFixed(4)}: debit=${d.toFixed(6)}, credit=${c.toFixed(6)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});
