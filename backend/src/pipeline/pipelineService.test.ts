import { PipelineService, Opportunity, PipelineStage } from './pipelineService';

const service = new PipelineService();

function makeOpp(
  id: string,
  stage: PipelineStage,
  value: number,
  probability: number,
  stageHistory: { stage: PipelineStage; enteredAt: Date }[] = [],
): Opportunity {
  return {
    id,
    clientName: `Client ${id}`,
    value,
    stage,
    probability,
    createdAt: new Date('2024-01-01'),
    stageHistory,
  };
}

describe('PipelineService', () => {
  describe('getStageStats', () => {
    it('returns correct count and total value per stage', () => {
      const opps: Opportunity[] = [
        makeOpp('1', 'Prospect', 10000, 10),
        makeOpp('2', 'Prospect', 20000, 10),
        makeOpp('3', 'Lead', 50000, 25),
        makeOpp('4', 'Proposal', 100000, 60),
      ];

      const stats = service.getStageStats(opps);

      const prospect = stats.find((s) => s.stage === 'Prospect')!;
      expect(prospect.count).toBe(2);
      expect(prospect.totalValue).toBe(30000);
      expect(prospect.avgValue).toBe(15000);

      const lead = stats.find((s) => s.stage === 'Lead')!;
      expect(lead.count).toBe(1);
      expect(lead.totalValue).toBe(50000);

      const negotiation = stats.find((s) => s.stage === 'Negotiation')!;
      expect(negotiation.count).toBe(0);
      expect(negotiation.totalValue).toBe(0);
      expect(negotiation.avgValue).toBe(0);
    });

    it('returns stats for all 7 stages', () => {
      const stats = service.getStageStats([]);
      expect(stats).toHaveLength(7);
    });

    it('returns zero conversionRate when stage has no opportunities', () => {
      const stats = service.getStageStats([]);
      for (const s of stats) {
        expect(s.conversionRate).toBe(0);
      }
    });

    it('calculates conversionRate to next stage correctly', () => {
      const opps: Opportunity[] = [
        makeOpp('1', 'Prospect', 1000, 10),
        makeOpp('2', 'Prospect', 1000, 10),
        makeOpp('3', 'Lead', 1000, 25),
      ];
      const stats = service.getStageStats(opps);
      const prospect = stats.find((s) => s.stage === 'Prospect')!;
      // 1 Lead / 2 Prospects = 50%
      expect(prospect.conversionRate).toBe(50);
    });
  });

  describe('calculateConversionRates', () => {
    it('returns rates between 0 and 100', () => {
      const opps: Opportunity[] = [
        makeOpp('1', 'Prospect', 1000, 10),
        makeOpp('2', 'Lead', 1000, 25),
        makeOpp('3', 'Qualified_Lead', 1000, 40),
      ];
      const rates = service.calculateConversionRates(opps);
      for (const rate of Object.values(rates)) {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(100);
      }
    });

    it('returns keys for each consecutive stage pair', () => {
      const rates = service.calculateConversionRates([]);
      expect(rates).toHaveProperty('Prospect->Lead');
      expect(rates).toHaveProperty('Lead->Qualified_Lead');
      expect(rates).toHaveProperty('Proposal->Negotiation');
      expect(rates).toHaveProperty('Negotiation->Closed_Won');
    });

    it('returns 0 for all rates when no opportunities', () => {
      const rates = service.calculateConversionRates([]);
      for (const rate of Object.values(rates)) {
        expect(rate).toBe(0);
      }
    });
  });

  describe('forecastRevenue', () => {
    it('calculates weighted sum of value * probability for non-closed stages', () => {
      const opps: Opportunity[] = [
        makeOpp('1', 'Proposal', 100000, 60),   // 60000
        makeOpp('2', 'Negotiation', 200000, 80), // 160000
        makeOpp('3', 'Closed_Won', 50000, 100),  // excluded
        makeOpp('4', 'Closed_Lost', 30000, 0),   // excluded
      ];
      const forecast = service.forecastRevenue(opps);
      expect(forecast).toBeCloseTo(220000);
    });

    it('returns 0 when all opportunities are closed', () => {
      const opps: Opportunity[] = [
        makeOpp('1', 'Closed_Won', 100000, 100),
        makeOpp('2', 'Closed_Lost', 50000, 0),
      ];
      expect(service.forecastRevenue(opps)).toBe(0);
    });

    it('returns 0 for empty list', () => {
      expect(service.forecastRevenue([])).toBe(0);
    });

    it('includes all non-closed stages in forecast', () => {
      const opps: Opportunity[] = [
        makeOpp('1', 'Prospect', 10000, 10),     // 1000
        makeOpp('2', 'Lead', 20000, 20),          // 4000
        makeOpp('3', 'Qualified_Lead', 30000, 40), // 12000
      ];
      expect(service.forecastRevenue(opps)).toBeCloseTo(17000);
    });
  });

  describe('transitionStage', () => {
    it('updates the stage to the new stage', () => {
      const opp = makeOpp('1', 'Prospect', 10000, 10, [
        { stage: 'Prospect', enteredAt: new Date('2024-01-01') },
      ]);
      const updated = service.transitionStage(opp, 'Lead');
      expect(updated.stage).toBe('Lead');
    });

    it('adds a new history entry for the new stage', () => {
      const opp = makeOpp('1', 'Prospect', 10000, 10, [
        { stage: 'Prospect', enteredAt: new Date('2024-01-01') },
      ]);
      const updated = service.transitionStage(opp, 'Lead');
      expect(updated.stageHistory).toHaveLength(2);
      expect(updated.stageHistory[1].stage).toBe('Lead');
      expect(updated.stageHistory[1].enteredAt).toBeInstanceOf(Date);
    });

    it('does not mutate the original opportunity', () => {
      const opp = makeOpp('1', 'Prospect', 10000, 10, [
        { stage: 'Prospect', enteredAt: new Date('2024-01-01') },
      ]);
      service.transitionStage(opp, 'Lead');
      expect(opp.stage).toBe('Prospect');
      expect(opp.stageHistory).toHaveLength(1);
    });

    it('preserves all other opportunity fields', () => {
      const opp = makeOpp('1', 'Proposal', 99000, 70, []);
      const updated = service.transitionStage(opp, 'Negotiation');
      expect(updated.id).toBe('1');
      expect(updated.value).toBe(99000);
      expect(updated.probability).toBe(70);
    });
  });

  describe('calculateAvgTimeInStage', () => {
    it('returns positive numbers for stages with history', () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

      const opp = makeOpp('1', 'Lead', 10000, 25, [
        { stage: 'Prospect', enteredAt: fourDaysAgo },
        { stage: 'Lead', enteredAt: twoDaysAgo },
      ]);

      const avgTimes = service.calculateAvgTimeInStage([opp]);
      expect(avgTimes['Prospect']).toBeGreaterThan(0);
      expect(avgTimes['Lead']).toBeGreaterThan(0);
    });

    it('returns empty object for opportunities with no history', () => {
      const opp = makeOpp('1', 'Prospect', 10000, 10, []);
      const avgTimes = service.calculateAvgTimeInStage([opp]);
      expect(Object.keys(avgTimes)).toHaveLength(0);
    });

    it('averages time across multiple opportunities in the same stage', () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

      const opp1 = makeOpp('1', 'Lead', 10000, 25, [
        { stage: 'Prospect', enteredAt: fourDaysAgo },
        { stage: 'Lead', enteredAt: twoDaysAgo },
      ]);
      const opp2 = makeOpp('2', 'Lead', 20000, 25, [
        { stage: 'Prospect', enteredAt: sixDaysAgo },
        { stage: 'Lead', enteredAt: twoDaysAgo },
      ]);

      const avgTimes = service.calculateAvgTimeInStage([opp1, opp2]);
      // opp1: 2 days in Prospect, opp2: 4 days in Prospect → avg 3 days
      expect(avgTimes['Prospect']).toBeCloseTo(3, 0);
    });
  });
});
