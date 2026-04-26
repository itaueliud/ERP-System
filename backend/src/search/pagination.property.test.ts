/**
 * Property-Based Tests for Pagination
 *
 * Property 15: Pagination Completeness
 * Validates: Requirements 24.10
 *
 * Uses random input generation (Math.random) to verify pagination properties hold across many inputs.
 */

// ─── Paginate function ───────────────────────────────────────────────────────

function paginate<T>(items: T[], page: number, pageSize: number): { data: T[]; total: number; totalPages: number } {
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    total: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDataset(): number[] {
  const size = randInt(1, 200);
  return Array.from({ length: size }, (_, i) => i + 1);
}

function collectAllPages<T>(items: T[], pageSize: number): T[] {
  const result: T[] = [];
  const first = paginate(items, 1, pageSize);
  for (let page = 1; page <= first.totalPages; page++) {
    const { data } = paginate(items, page, pageSize);
    result.push(...data);
  }
  return result;
}

// ─── Property 15: Pagination Completeness ────────────────────────────────────

/**
 * Validates: Requirements 24.10
 */
describe('Property 15: Pagination Completeness - concatenating all pages returns all items', () => {
  it('concatenated pages equal original dataset for 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const items = randomDataset();
      const pageSize = randInt(1, 50);
      const allPages = collectAllPages(items, pageSize);

      if (allPages.length !== items.length) {
        failures.push(
          `items.length=${items.length}, pageSize=${pageSize}: ` +
          `concatenated length=${allPages.length}`,
        );
        continue;
      }

      for (let j = 0; j < items.length; j++) {
        if (allPages[j] !== items[j]) {
          failures.push(
            `items.length=${items.length}, pageSize=${pageSize}: ` +
            `mismatch at index ${j}: expected ${items[j]}, got ${allPages[j]}`,
          );
          break;
        }
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Total count is preserved across all page sizes ──────────────────────────

describe('Total count is preserved across all page sizes', () => {
  it('sum of page lengths equals total items for 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const items = randomDataset();
      const pageSize = randInt(1, 50);
      const first = paginate(items, 1, pageSize);
      let sum = 0;

      for (let page = 1; page <= first.totalPages; page++) {
        sum += paginate(items, page, pageSize).data.length;
      }

      if (sum !== items.length) {
        failures.push(
          `items.length=${items.length}, pageSize=${pageSize}: sum of page lengths=${sum}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── No item appears twice across pages ──────────────────────────────────────

describe('No item appears twice across pages', () => {
  it('no duplicates when collecting all pages for 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const items = randomDataset();
      const pageSize = randInt(1, 50);
      const allPages = collectAllPages(items, pageSize);

      // Since items are unique sequential numbers, check for duplicates by index
      if (allPages.length !== new Set(allPages).size) {
        failures.push(
          `items.length=${items.length}, pageSize=${pageSize}: duplicates found in concatenated pages`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Last page may be partial but not empty ───────────────────────────────────

describe('Last page may be partial but not empty', () => {
  it('last page has 1 to pageSize items for 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const items = randomDataset();
      const pageSize = randInt(1, 50);
      const { totalPages } = paginate(items, 1, pageSize);
      const lastPage = paginate(items, totalPages, pageSize);

      if (lastPage.data.length < 1 || lastPage.data.length > pageSize) {
        failures.push(
          `items.length=${items.length}, pageSize=${pageSize}: ` +
          `last page has ${lastPage.data.length} items (expected 1..${pageSize})`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Page count is correct ────────────────────────────────────────────────────

describe('Page count is correct', () => {
  it('totalPages equals ceil(total / pageSize) for 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const items = randomDataset();
      const pageSize = randInt(1, 50);
      const { total, totalPages } = paginate(items, 1, pageSize);
      const expected = Math.ceil(total / pageSize);

      if (totalPages !== expected) {
        failures.push(
          `items.length=${items.length}, pageSize=${pageSize}: ` +
          `totalPages=${totalPages}, expected=${expected}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});
