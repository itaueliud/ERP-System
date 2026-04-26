/**
 * Property-Based Tests for Search Sort Metamorphic Property
 *
 * Property 28: Sort Preserves Count
 * Validates: Requirements 24.11
 *
 * Metamorphic property: sorting a dataset by any field (relevance, date,
 * amount, alphabetically) is a permutation — it never adds or removes records.
 * The total count must remain constant regardless of the sort field chosen.
 *
 * Uses random input generation (Math.random) to verify the property holds
 * across many random datasets and sort configurations.
 */

import { SearchResultService, SortBy } from './searchResultService';
import type { SearchResult } from './searchService';
import type { EntityType } from './searchService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ENTITY_TYPES: EntityType[] = ['client', 'project', 'contract', 'property'];
const SORT_FIELDS: SortBy[] = ['relevance', 'date', 'amount', 'alpha'];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a random alphanumeric string of given length */
function randString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Generate a random SearchResult record */
function randomSearchResult(index: number): SearchResult {
  const amount = randFloat(0, 1_000_000);
  // Embed amount in snippet so the amount-sort extractor can find it
  const snippet = `Amount: ${amount.toFixed(2)} - ${randString(randInt(10, 80))}`;
  return {
    entityType: pick(ENTITY_TYPES),
    id: `rec-${index}-${Math.random().toString(36).slice(2)}`,
    title: randString(randInt(5, 50)),
    snippet,
    relevanceScore: randFloat(0, 1),
  };
}

/** Generate a random dataset of 0–200 SearchResult records */
function randomDataset(): SearchResult[] {
  const size = randInt(0, 200);
  return Array.from({ length: size }, (_, i) => randomSearchResult(i));
}

// ─── Property 28: Sort Preserves Count ───────────────────────────────────────

/**
 * Validates: Requirements 24.11
 *
 * Metamorphic property: for any dataset D and any sort field S,
 *   |sortResults(D, S)| === |D|
 *
 * Sorting is a permutation — it must never add or remove records.
 */
describe('Property 28: Sort Preserves Count', () => {
  const service = new SearchResultService();

  it('sort count equals original count for 200 random datasets and sort fields', () => {
    const failures: string[] = [];

    for (let i = 0; i < 200; i++) {
      const dataset = randomDataset();
      const sortBy = pick(SORT_FIELDS);

      const sorted = service.sortResults(dataset, sortBy);

      if (sorted.length !== dataset.length) {
        failures.push(
          `iteration=${i}, sortBy=${sortBy}, originalCount=${dataset.length}, sortedCount=${sorted.length}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('all four sort fields preserve count on the same dataset', () => {
    /**
     * For each random dataset, apply every sort field and verify all produce
     * the same count as the original.
     */
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dataset = randomDataset();
      const originalCount = dataset.length;

      for (const sortBy of SORT_FIELDS) {
        const sorted = service.sortResults(dataset, sortBy);
        if (sorted.length !== originalCount) {
          failures.push(
            `iteration=${i}, sortBy=${sortBy}, originalCount=${originalCount}, sortedCount=${sorted.length}`,
          );
        }
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('sorting twice by the same field preserves count', () => {
    /**
     * Idempotent count: applying the same sort twice must not change the count.
     */
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dataset = randomDataset();
      const sortBy = pick(SORT_FIELDS);

      const sortedOnce = service.sortResults(dataset, sortBy);
      const sortedTwice = service.sortResults(sortedOnce, sortBy);

      if (sortedTwice.length !== dataset.length) {
        failures.push(
          `iteration=${i}, sortBy=${sortBy}, originalCount=${dataset.length}, sortedTwiceCount=${sortedTwice.length}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('sorting by different fields sequentially preserves count', () => {
    /**
     * Chaining two different sort operations must not change the count.
     */
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dataset = randomDataset();
      const sortBy1 = pick(SORT_FIELDS);
      const sortBy2 = pick(SORT_FIELDS);

      const afterSort1 = service.sortResults(dataset, sortBy1);
      const afterSort2 = service.sortResults(afterSort1, sortBy2);

      if (afterSort2.length !== dataset.length) {
        failures.push(
          `iteration=${i}, sortBy1=${sortBy1}, sortBy2=${sortBy2}, ` +
          `originalCount=${dataset.length}, finalCount=${afterSort2.length}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('sorted count is always non-negative', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dataset = randomDataset();
      const sortBy = pick(SORT_FIELDS);
      const sorted = service.sortResults(dataset, sortBy);

      if (sorted.length < 0) {
        failures.push(`iteration=${i}, sortBy=${sortBy}, sortedCount=${sorted.length} is negative`);
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('empty dataset stays empty after sorting by any field', () => {
    for (const sortBy of SORT_FIELDS) {
      const sorted = service.sortResults([], sortBy);
      expect(sorted).toHaveLength(0);
    }
  });

  it('single-element dataset stays length 1 after sorting by any field', () => {
    const single = [randomSearchResult(0)];
    for (const sortBy of SORT_FIELDS) {
      const sorted = service.sortResults(single, sortBy);
      expect(sorted).toHaveLength(1);
    }
  });
});
