/**
 * Property-Based Tests for CurrencyConversionService
 *
 * Property 13: Currency Conversion Consistency
 * Validates: Requirements 41.7
 *
 * FOR ALL amounts and exchange rates, converting currency A → B → A
 * SHALL return the original amount within rounding tolerance (0.01).
 *
 * Uses Math.random-based generation (no fast-check).
 */

import { CurrencyConversionService } from './currencyConversionService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('./currencyService', () => ({
  currencyService: {
    getExchangeRate: jest.fn(),
  },
}));

jest.mock('../i18n/localizationService', () => ({
  localizationService: {
    formatCurrency: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { currencyService } from './currencyService';

const mockGetExchangeRate = currencyService.getExchangeRate as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a random float in [min, max] */
function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Pick a random element from an array */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick two distinct elements from an array */
function pickTwo<T>(arr: T[]): [T, T] {
  const a = pick(arr);
  let b = pick(arr);
  while (b === a) b = pick(arr);
  return [a, b];
}

// ---------------------------------------------------------------------------
// Currency pairs under test (Requirement 41.7 — African market currencies)
// ---------------------------------------------------------------------------

const CURRENCIES = ['USD', 'EUR', 'KES', 'TZS', 'UGX', 'NGN', 'GHS', 'ZAR', 'EGP', 'MAD'];

// Realistic exchange rates relative to USD (used to derive cross-rates)
const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  KES: 130.5,
  TZS: 2530.0,
  UGX: 3750.0,
  NGN: 1550.0,
  GHS: 12.5,
  ZAR: 18.7,
  EGP: 48.5,
  MAD: 10.1,
};

/**
 * Returns the exchange rate from `from` to `to` using USD as pivot.
 * rate(A→B) = rate(USD→B) / rate(USD→A)
 */
function crossRate(from: string, to: string): number {
  if (from === to) return 1;
  return USD_RATES[to] / USD_RATES[from];
}

// ---------------------------------------------------------------------------
// Property 13: Currency Conversion Consistency (round-trip A → B → A)
// ---------------------------------------------------------------------------

describe('Property 13: Currency Conversion Consistency', () => {
  /**
   * Validates: Requirements 41.7
   *
   * For any amount in currency A, converting to currency B and back to A
   * SHALL produce a result within 0.01 of the original amount.
   */

  let service: CurrencyConversionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CurrencyConversionService();

    // Wire up the mock so it returns the correct cross-rate for any pair
    mockGetExchangeRate.mockImplementation(async (from: string, to: string) => {
      return crossRate(from, to);
    });
  });

  it('round-trip A → B → A is within 0.01 for 200 random (amount, currency pair) inputs', async () => {
    const failures: string[] = [];

    for (let i = 0; i < 200; i++) {
      // Generate a random amount covering small, large, and decimal values
      const amount = randFloat(0.01, 1_000_000);

      // Pick two distinct currencies
      const [currA, currB] = pickTwo(CURRENCIES);

      // Step 1: convert A → B
      const resultAtoB = await service.convertAmount(amount, currA, currB);

      // Step 2: convert B → A (round-trip)
      const resultBtoA = await service.convertAmount(resultAtoB.convertedAmount, currB, currA);

      const diff = Math.abs(resultBtoA.convertedAmount - amount);

      if (diff > 0.01) {
        failures.push(
          `amount=${amount.toFixed(4)} ${currA} → ${currB} → ${currA}: ` +
            `got ${resultBtoA.convertedAmount.toFixed(4)}, diff=${diff.toFixed(6)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('round-trip is within 0.01 for small amounts (0.01 – 1.00)', async () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const amount = randFloat(0.01, 1.0);
      const [currA, currB] = pickTwo(CURRENCIES);

      const resultAtoB = await service.convertAmount(amount, currA, currB);
      const resultBtoA = await service.convertAmount(resultAtoB.convertedAmount, currB, currA);

      const diff = Math.abs(resultBtoA.convertedAmount - amount);

      if (diff > 0.01) {
        failures.push(
          `small amount=${amount.toFixed(4)} ${currA} → ${currB} → ${currA}: ` +
            `got ${resultBtoA.convertedAmount.toFixed(4)}, diff=${diff.toFixed(6)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('round-trip is within 0.01 for large amounts (100,000 – 1,000,000)', async () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const amount = randFloat(100_000, 1_000_000);
      const [currA, currB] = pickTwo(CURRENCIES);

      const resultAtoB = await service.convertAmount(amount, currA, currB);
      const resultBtoA = await service.convertAmount(resultAtoB.convertedAmount, currB, currA);

      const diff = Math.abs(resultBtoA.convertedAmount - amount);

      if (diff > 0.01) {
        failures.push(
          `large amount=${amount.toFixed(4)} ${currA} → ${currB} → ${currA}: ` +
            `got ${resultBtoA.convertedAmount.toFixed(4)}, diff=${diff.toFixed(6)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('round-trip is within 0.01 for decimal amounts (1.00 – 100.00)', async () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const amount = randFloat(1.0, 100.0);
      const [currA, currB] = pickTwo(CURRENCIES);

      const resultAtoB = await service.convertAmount(amount, currA, currB);
      const resultBtoA = await service.convertAmount(resultAtoB.convertedAmount, currB, currA);

      const diff = Math.abs(resultBtoA.convertedAmount - amount);

      if (diff > 0.01) {
        failures.push(
          `decimal amount=${amount.toFixed(4)} ${currA} → ${currB} → ${currA}: ` +
            `got ${resultBtoA.convertedAmount.toFixed(4)}, diff=${diff.toFixed(6)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });

  it('same-currency round-trip returns exact original amount', async () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      const amount = randFloat(0.01, 1_000_000);
      const curr = pick(CURRENCIES);

      // A → A should be identity (rate = 1)
      const result = await service.convertAmount(amount, curr, curr);

      const diff = Math.abs(result.convertedAmount - amount);

      if (diff > 0.01) {
        failures.push(
          `same-currency ${curr}: amount=${amount.toFixed(4)}, ` +
            `got ${result.convertedAmount.toFixed(4)}, diff=${diff.toFixed(6)}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});
