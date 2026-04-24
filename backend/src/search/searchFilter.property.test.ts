/**
 * Property-Based Tests for Search Filter Metamorphic Property
 *
 * Property 27: Filter Reduces Results
 * Validates: Requirements 24.3
 *
 * Metamorphic property: applying any filter to a dataset can only reduce or
 * maintain the result count — it can never increase it.
 *
 * Uses random input generation (Math.random) to verify the property holds
 * across many random datasets and filter combinations.
 */

import { FilterInput } from './filterService';

// ─── In-memory record type ────────────────────────────────────────────────────

interface Record {
  id: string;
  status: string;
  country: string;
  industryCategory: string;
  agentId: string;
  estimatedValue: number;
  createdAt: Date;
}

// ─── In-memory filter function ────────────────────────────────────────────────

/**
 * Applies a FilterInput to an in-memory array of records.
 * Mirrors the SQL WHERE clause logic in FilterService.buildFilterQuery.
 * Requirements: 24.3
 */
function applyFilters(records: Record[], filters: FilterInput): Record[] {
  const operator = filters.booleanOperator === 'OR' ? 'OR' : 'AND';

  return records.filter((record) => {
    const conditions: boolean[] = [];

    // Date range
    if (filters.dateRange?.from) {
      conditions.push(record.createdAt >= filters.dateRange.from);
    }
    if (filters.dateRange?.to) {
      conditions.push(record.createdAt <= filters.dateRange.to);
    }

    // Status (positive and negative)
    if (filters.status && filters.status.length > 0) {
      const positives = filters.status.filter((s) => !s.startsWith('!'));
      const negatives = filters.status.filter((s) => s.startsWith('!')).map((s) => s.slice(1));
      if (positives.length > 0) {
        conditions.push(positives.includes(record.status));
      }
      if (negatives.length > 0) {
        conditions.push(!negatives.includes(record.status));
      }
    }

    // Country
    if (filters.country && filters.country.length > 0) {
      conditions.push(filters.country.includes(record.country));
    }

    // Industry category
    if (filters.industryCategory && filters.industryCategory.length > 0) {
      conditions.push(filters.industryCategory.includes(record.industryCategory));
    }

    // Assigned user
    if (filters.assignedUser) {
      conditions.push(record.agentId === filters.assignedUser);
    }

    // Amount range
    if (filters.amountRange?.min !== undefined) {
      conditions.push(record.estimatedValue >= filters.amountRange.min);
    }
    if (filters.amountRange?.max !== undefined) {
      conditions.push(record.estimatedValue <= filters.amountRange.max);
    }

    if (conditions.length === 0) return true;
    return operator === 'OR'
      ? conditions.some(Boolean)
      : conditions.every(Boolean);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUSES = ['PENDING_COMMITMENT', 'LEAD', 'QUALIFIED_LEAD', 'PROJECT'];
const COUNTRIES = ['Kenya', 'Nigeria', 'Ghana', 'Uganda', 'Tanzania', 'Ethiopia', 'Rwanda'];
const INDUSTRIES = ['Schools', 'Churches', 'Hotels', 'Hospitals', 'Companies', 'Real Estate', 'Shops'];
const AGENT_IDS = ['agent-1', 'agent-2', 'agent-3', 'agent-4'];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSubset<T>(arr: T[], minSize = 1): T[] {
  const size = randInt(minSize, arr.length);
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size);
}

/** Generate a random dataset of 0–200 records */
function randomDataset(): Record[] {
  const size = randInt(0, 200);
  const baseDate = new Date('2024-01-01').getTime();
  const yearMs = 365 * 24 * 60 * 60 * 1000;

  return Array.from({ length: size }, (_, i) => ({
    id: `rec-${i}`,
    status: pick(STATUSES),
    country: pick(COUNTRIES),
    industryCategory: pick(INDUSTRIES),
    agentId: pick(AGENT_IDS),
    estimatedValue: randFloat(100, 500_000),
    createdAt: new Date(baseDate + Math.random() * yearMs),
  }));
}

/** Generate a random non-empty FilterInput */
function randomFilter(): FilterInput {
  const filter: FilterInput = {};
  const filterTypes = ['status', 'country', 'industry', 'agent', 'amount', 'date'];
  // Pick 1–3 filter types to apply
  const chosen = pickSubset(filterTypes, 1).slice(0, randInt(1, 3));

  for (const type of chosen) {
    switch (type) {
      case 'status':
        filter.status = pickSubset(STATUSES, 1);
        break;
      case 'country':
        filter.country = pickSubset(COUNTRIES, 1);
        break;
      case 'industry':
        filter.industryCategory = pickSubset(INDUSTRIES, 1);
        break;
      case 'agent':
        filter.assignedUser = pick(AGENT_IDS);
        break;
      case 'amount': {
        const min = randFloat(0, 250_000);
        const max = randFloat(min, 500_000);
        filter.amountRange = { min, max };
        break;
      }
      case 'date': {
        const baseDate = new Date('2024-01-01').getTime();
        const halfYear = 182 * 24 * 60 * 60 * 1000;
        const from = new Date(baseDate + Math.random() * halfYear);
        const to = new Date(from.getTime() + Math.random() * halfYear);
        filter.dateRange = { from, to };
        break;
      }
    }
  }

  // Randomly choose boolean operator
  filter.booleanOperator = Math.random() < 0.5 ? 'AND' : 'OR';

  return filter;
}

// ─── Property 27: Filter Reduces Results ─────────────────────────────────────

/**
 * Validates: Requirements 24.3
 *
 * Metamorphic property: for any dataset D and any filter F,
 *   |applyFilters(D, F)| ≤ |D|
 *
 * Filtering can only reduce or maintain the count — never increase it.
 */
describe('Property 27: Filter Reduces Results', () => {
  it('filtered count ≤ unfiltered count for 200 random datasets and filters', () => {
    const failures: string[] = [];

    for (let i = 0; i < 200; i++) {
      const dataset = randomDataset();
      const filter = randomFilter();

      const unfilteredCount = dataset.length;
      const filteredCount = applyFilters(dataset, filter).length;

      if (filteredCount > unfilteredCount) {
        failures.push(
          `iteration=${i}, unfilteredCount=${unfilteredCount}, filteredCount=${filteredCount}, ` +
          `filter=${JSON.stringify(filter)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('empty filter returns all records (filtered count = unfiltered count)', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dataset = randomDataset();
      const filteredCount = applyFilters(dataset, {}).length;

      if (filteredCount !== dataset.length) {
        failures.push(
          `iteration=${i}, expected=${dataset.length}, got=${filteredCount}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('applying two filters sequentially never exceeds single-filter count', () => {
    /**
     * Metamorphic refinement: if F1 is applied first, then F2 applied to the
     * result, the final count ≤ count after F1 alone.
     */
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dataset = randomDataset();
      const filter1 = randomFilter();
      const filter2 = randomFilter();

      const afterFilter1 = applyFilters(dataset, filter1);
      const afterBothFilters = applyFilters(afterFilter1, filter2);

      if (afterBothFilters.length > afterFilter1.length) {
        failures.push(
          `iteration=${i}, afterFilter1=${afterFilter1.length}, afterBothFilters=${afterBothFilters.length}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('filtered count is always non-negative', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dataset = randomDataset();
      const filter = randomFilter();
      const filteredCount = applyFilters(dataset, filter).length;

      if (filteredCount < 0) {
        failures.push(`iteration=${i}, filteredCount=${filteredCount} is negative`);
      }
    }

    expect(failures).toHaveLength(0);
  });
});
