/**
 * Property-Based Tests for PipelineService
 *
 * Property 35: Model-Based Testing - Pipeline Value
 * Validates: Requirements 52.2
 *
 * Uses random input generation (Math.random) to verify properties hold across many inputs.
 */

import {
  PipelineService,
  Opportunity,
  PipelineStage,
  PIPELINE_STAGE_ORDER,
} from './pipelineService';

const service = new PipelineService();

// ─── Helpers ────────────────────────────────────────────────────────────────

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1));
}

function randomStage(): PipelineStage {
  return PIPELINE_STAGE_ORDER[randInt(0, PIPELINE_STAGE_ORDER.length - 1)];
}

function randomOpportunity(id: number): Opportunity {
  return {
    id: `opp-${id}`,
    clientName: `Client ${id}`,
    value: randFloat(1, 500_000),
    stage: randomStage(),
    probability: randInt(0, 100),
    createdAt: new Date('2024-01-01'),
    stageHistory: [],
  };
}

function randomOpportunities(count: number): Opportunity[] {
  return Array.from({ length: count }, (_, i) => randomOpportunity(i));
}

// ─── Property 35 (Model-Based): Total pipeline value equals sum of all opportunity values ───

describe('Property 35 (Model-Based): Total pipeline value equals sum of all opportunity values', () => {
  /**
   * Validates: Requirements 52.2
   * For any set of opportunities, sum of getStageStats totalValues = sum of all opportunity values.
   * Reference: simple sum of all opportunity values.
   * Optimized: sum of totalValue across all stage stats.
   * Both must agree.
   */
  it('sum of stage totalValues equals sum of all opportunity values for 100 random sets', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const count = randInt(1, 20);
      const opps = randomOpportunities(count);

      // Reference: simple sum of all opportunity values
      const referenceTotal = opps.reduce((sum, opp) => sum + opp.value, 0);

      // Optimized: sum of totalValue across all stage stats
      const stats = service.getStageStats(opps);
      const optimizedTotal = stats.reduce((sum, s) => sum + s.totalValue, 0);

      if (Math.abs(optimizedTotal - referenceTotal) > 1e-6) {
        failures.push(
          `iteration=${i}, count=${count}: ` +
            `optimizedTotal=${optimizedTotal}, referenceTotal=${referenceTotal}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Stage stats count equals total opportunities ────────────────────────────

describe('Stage stats count equals total opportunities', () => {
  it('sum of counts across all stages equals total number of opportunities for 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const count = randInt(1, 20);
      const opps = randomOpportunities(count);

      const stats = service.getStageStats(opps);
      const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

      if (totalCount !== opps.length) {
        failures.push(
          `iteration=${i}: expected count=${opps.length}, got totalCount=${totalCount}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Forecast revenue is always <= total pipeline value ──────────────────────

describe('Forecast revenue is always <= total pipeline value', () => {
  it('forecastRevenue(opps) <= sum of all opportunity values for 100 random inputs', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const count = randInt(1, 20);
      const opps = randomOpportunities(count);

      const totalValue = opps.reduce((sum, opp) => sum + opp.value, 0);
      const forecast = service.forecastRevenue(opps);

      // probability <= 100%, so forecast <= totalValue
      if (forecast > totalValue + 1e-9) {
        failures.push(
          `iteration=${i}: forecast=${forecast} > totalValue=${totalValue}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Transition stage preserves opportunity value ─────────────────────────────

describe('Transition stage preserves opportunity value', () => {
  it('after transitionStage, opportunity.value remains unchanged for 50 random transitions', () => {
    const failures: string[] = [];

    for (let i = 0; i < 50; i++) {
      const opp = randomOpportunity(i);
      const newStage = randomStage();
      const originalValue = opp.value;

      const updated = service.transitionStage(opp, newStage);

      if (Math.abs(updated.value - originalValue) > 1e-9) {
        failures.push(
          `iteration=${i}: originalValue=${originalValue}, updatedValue=${updated.value}`,
        );
      }
    }

    expect(failures).toHaveLength(0);
  });
});

// ─── Conversion rates are always between 0 and 100 ───────────────────────────

describe('Conversion rates are always between 0 and 100', () => {
  it('all rates in calculateConversionRates are in [0, 100] for 100 random opportunity sets', () => {
    const failures: string[] = [];

    for (let i = 0; i < 100; i++) {
      const count = randInt(1, 20);
      const opps = randomOpportunities(count);

      const rates = service.calculateConversionRates(opps);

      for (const [key, rate] of Object.entries(rates)) {
        if (rate < 0 || rate > 100) {
          failures.push(
            `iteration=${i}, transition=${key}: rate=${rate} is outside [0, 100]`,
          );
        }
      }
    }

    expect(failures).toHaveLength(0);
  });
});
