export type PipelineStage =
  | 'Prospect'
  | 'Lead'
  | 'Qualified_Lead'
  | 'Proposal'
  | 'Negotiation'
  | 'Closed_Won'
  | 'Closed_Lost';

export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  'Prospect',
  'Lead',
  'Qualified_Lead',
  'Proposal',
  'Negotiation',
  'Closed_Won',
  'Closed_Lost',
];

export interface StageHistoryEntry {
  stage: PipelineStage;
  enteredAt: Date;
}

export interface Opportunity {
  id: string;
  clientName: string;
  value: number;
  stage: PipelineStage;
  probability: number; // 0-100
  createdAt: Date;
  stageHistory: StageHistoryEntry[];
}

export interface PipelineStats {
  stage: PipelineStage;
  count: number;
  totalValue: number;
  avgValue: number;
  conversionRate: number; // rate to next stage (0-100)
}

export class PipelineService {
  /**
   * Returns stats per stage: count, totalValue, avgValue, conversionRate to next stage.
   */
  getStageStats(opportunities: Opportunity[]): PipelineStats[] {
    const countByStage: Record<PipelineStage, number> = {} as Record<PipelineStage, number>;
    const valueByStage: Record<PipelineStage, number> = {} as Record<PipelineStage, number>;

    for (const stage of PIPELINE_STAGE_ORDER) {
      countByStage[stage] = 0;
      valueByStage[stage] = 0;
    }

    for (const opp of opportunities) {
      countByStage[opp.stage] += 1;
      valueByStage[opp.stage] += opp.value;
    }

    return PIPELINE_STAGE_ORDER.map((stage, idx) => {
      const count = countByStage[stage];
      const totalValue = valueByStage[stage];
      const avgValue = count > 0 ? totalValue / count : 0;

      const nextStage = PIPELINE_STAGE_ORDER[idx + 1];
      let conversionRate = 0;
      if (nextStage && count > 0) {
        conversionRate = Math.min(100, (countByStage[nextStage] / count) * 100);
      }

      return { stage, count, totalValue, avgValue, conversionRate };
    });
  }

  /**
   * Returns conversion rate (0-100) from each stage to the next stage.
   */
  calculateConversionRates(opportunities: Opportunity[]): Record<string, number> {
    const stats = this.getStageStats(opportunities);
    const rates: Record<string, number> = {};

    for (let i = 0; i < stats.length - 1; i++) {
      const current = stats[i];
      const next = stats[i + 1];
      const key = `${current.stage}->${next.stage}`;
      rates[key] = current.conversionRate;
    }

    return rates;
  }

  /**
   * Returns average days spent in each stage, computed from stageHistory.
   */
  calculateAvgTimeInStage(opportunities: Opportunity[]): Record<string, number> {
    const totalDays: Record<string, number> = {};
    const stageCounts: Record<string, number> = {};

    for (const opp of opportunities) {
      for (let i = 0; i < opp.stageHistory.length; i++) {
        const entry = opp.stageHistory[i];
        const nextEntry = opp.stageHistory[i + 1];
        const exitTime = nextEntry ? nextEntry.enteredAt : new Date();
        const daysInStage =
          (exitTime.getTime() - entry.enteredAt.getTime()) / (1000 * 60 * 60 * 24);

        if (!totalDays[entry.stage]) {
          totalDays[entry.stage] = 0;
          stageCounts[entry.stage] = 0;
        }
        totalDays[entry.stage] += daysInStage;
        stageCounts[entry.stage] += 1;
      }
    }

    const result: Record<string, number> = {};
    for (const stage of Object.keys(totalDays)) {
      result[stage] = stageCounts[stage] > 0 ? totalDays[stage] / stageCounts[stage] : 0;
    }
    return result;
  }

  /**
   * Forecasts revenue as weighted sum of (value * probability/100) for non-closed stages.
   */
  forecastRevenue(opportunities: Opportunity[]): number {
    const closedStages: PipelineStage[] = ['Closed_Won', 'Closed_Lost'];
    return opportunities
      .filter((opp) => !closedStages.includes(opp.stage))
      .reduce((sum, opp) => sum + opp.value * (opp.probability / 100), 0);
  }

  /**
   * Transitions an opportunity to a new stage, appending a history entry.
   */
  transitionStage(opportunity: Opportunity, newStage: PipelineStage): Opportunity {
    return {
      ...opportunity,
      stage: newStage,
      stageHistory: [
        ...opportunity.stageHistory,
        { stage: newStage, enteredAt: new Date() },
      ],
    };
  }
}
