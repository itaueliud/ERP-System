/**
 * Property-Based Tests for CommissionService
 *
 * Property 34: Model-Based Testing - Commission Calculation
 * Validates: Requirements 53.1
 *
 * Uses random input generation (Math.random) to verify properties hold across many inputs.
 */

import { CommissionService, CommissionRate, CommissionTier } from './commissionService';

const service = new CommissionService();

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns a random float in [min, max] */
function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Generate a random deal value between 1 and 1,000,000 */
function randomDealValue(): number {
  return randFloat(1, 1_000_000);
}

/** Generate a random percentage rate between 0.1 and 20 */
function randomRate(): number {
  return randFloat(0.1, 20);
}

// ─── Reference implementation ────────────────────────────────────────────────

/**
 * Simple reference implementation used for model-based comparison (Property 34).
 * Deliberately straightforward if/else logic — no optimisations.
 */
function referenceCalculateCommission(dealValue: number, rate: CommissionRate): number {
  if (rate.structure === 'percentage') {
    if (rate.rate === undefined) return 0;
    return dealValue * (rate.rate / 100);
  }

  if (rate.structure === 'flat_rate') {
    if (rate.rate === undefined) return 0;
    return rate.rate;
  }

  if (rate.structure === 'tiered') {
    if (!rate.tiers || rate.tiers.length === 0) return 0;
    for (const tier of rate.tiers) {
      if (dealValue >= tier.minValue && dealValue <= tier.maxValue) {
        return dealValue * (tier.rate / 100);
      }
    }
    return 0;
  }

  return 0;
}

// ─── Tiered rate fixture ─────────────────────────────────────────────────────

const TIERS: CommissionTier[] = [
  { minValue: 0,      maxValue: 50_000,    rate: 3 },
  { minValue: 50_001, maxValue: 200_000,   rate: 5 },
  { minValue: 200_001, maxValue: 1_000_000, rate: 7 },
];

const tieredRate: CommissionRate = {
  industryCategory: 'Technology',
  structure: 'tiered',
  tiers: TIERS,
};

// ─── Property 1: Percentage commission is proportional to deal value ─────────

describe('Property 1: Percentage commission is proportional to deal value', () => {
  it('commission / dealValue ≈ rate/100 for 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dealValue = randomDealValue();
      const rate = randomRate();
      const commissionRate: CommissionRate = {
        industryCategory: 'Test',
        structure: 'percentage',
        rate,
      };

      const commission = service.calculateCommission(dealValue, commissionRate);
      const expectedRatio = rate / 100;
      const actualRatio = commission / dealValue;

      if (Math.abs(actualRatio - expectedRatio) > 1e-9) {
        failures.push(
          `dealValue=${dealValue.toFixed(2)}, rate=${rate.toFixed(4)}: ` +
          `expected ratio ${expectedRatio}, got ${actualRatio}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Property 2: Flat rate commission is independent of deal value ────────────

describe('Property 2: Flat rate commission is independent of deal value', () => {
  it('all commissions equal the flat rate for 100 random deal values', () => {
    const flatAmount = randFloat(100, 10_000);
    const commissionRate: CommissionRate = {
      industryCategory: 'Retail',
      structure: 'flat_rate',
      rate: flatAmount,
    };

    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const dealValue = randomDealValue();
      const commission = service.calculateCommission(dealValue, commissionRate);

      if (Math.abs(commission - flatAmount) > 1e-9) {
        failures.push(
          `dealValue=${dealValue.toFixed(2)}: expected ${flatAmount}, got ${commission}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Property 3: Tiered commission is monotonically non-decreasing within a tier

describe('Property 3: Tiered commission is monotonically non-decreasing within a tier', () => {
  TIERS.forEach((tier, idx) => {
    it(`commission(V1) <= commission(V2) for 50 random pairs in tier ${idx + 1} [${tier.minValue}, ${tier.maxValue}]`, () => {
      const failures: string[] = [];

      for (let i = 0; i < 50; i++) {
        const v1 = randFloat(tier.minValue, tier.maxValue);
        const v2 = randFloat(tier.minValue, tier.maxValue);
        const [lo, hi] = v1 <= v2 ? [v1, v2] : [v2, v1];

        const c1 = service.calculateCommission(lo, tieredRate);
        const c2 = service.calculateCommission(hi, tieredRate);

        if (c1 > c2 + 1e-9) {
          failures.push(
            `V1=${lo.toFixed(2)} -> commission=${c1.toFixed(4)}, ` +
            `V2=${hi.toFixed(2)} -> commission=${c2.toFixed(4)} (not non-decreasing)`,
          );
        }
      }

      expect(failures).toHaveLength(0);
    });
  });
});

// ─── Property 4: Commission amount is always non-negative ────────────────────

describe('Property 4: Commission amount is always non-negative', () => {
  it('commission >= 0 for 200 random inputs across all structure types', () => {
    const failures: string[] = [];

    for (let i = 0; i < 200; i++) {
      const dealValue = randomDealValue();
      const structureIdx = i % 3;

      let commissionRate: CommissionRate;

      if (structureIdx === 0) {
        commissionRate = {
          industryCategory: 'Test',
          structure: 'percentage',
          rate: randomRate(),
        };
      } else if (structureIdx === 1) {
        commissionRate = {
          industryCategory: 'Test',
          structure: 'flat_rate',
          rate: randFloat(0, 10_000),
        };
      } else {
        commissionRate = tieredRate;
      }

      const commission = service.calculateCommission(dealValue, commissionRate);

      if (commission < 0) {
        failures.push(
          `structure=${commissionRate.structure}, dealValue=${dealValue.toFixed(2)}: ` +
          `commission=${commission} is negative`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Property 34 (Model-Based): Optimized vs Reference implementation ────────

describe('Property 34 (Model-Based): CommissionService matches reference implementation', () => {
  /**
   * Validates: Requirements 53.1
   * For 200 random inputs, the optimized CommissionService.calculateCommission
   * must return the same result as the simple reference implementation.
   */
  it('optimized and reference implementations agree for 200 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 200; i++) {
      const dealValue = randomDealValue();
      const structureIdx = i % 3;

      let commissionRate: CommissionRate;

      if (structureIdx === 0) {
        // percentage
        commissionRate = {
          industryCategory: 'Test',
          structure: 'percentage',
          rate: randomRate(),
        };
      } else if (structureIdx === 1) {
        // flat_rate
        commissionRate = {
          industryCategory: 'Test',
          structure: 'flat_rate',
          rate: randFloat(100, 10_000),
        };
      } else {
        // tiered
        commissionRate = tieredRate;
      }

      const optimized = service.calculateCommission(dealValue, commissionRate);
      const reference = referenceCalculateCommission(dealValue, commissionRate);

      if (Math.abs(optimized - reference) > 1e-9) {
        failures.push(
          `structure=${commissionRate.structure}, dealValue=${dealValue.toFixed(2)}: ` +
          `optimized=${optimized}, reference=${reference}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});
