export type CommissionStructure = 'percentage' | 'tiered' | 'flat_rate';

export type CommissionStatus = 'Pending' | 'Approved' | 'Paid' | 'Rejected';

export interface CommissionTier {
  minValue: number;
  maxValue: number;
  rate: number; // percentage rate for this tier
}

export interface CommissionRate {
  industryCategory: string;
  structure: CommissionStructure;
  rate?: number; // used for 'percentage' and 'flat_rate'
  tiers?: CommissionTier[]; // used for 'tiered'
}

export interface Commission {
  id: string;
  agentId: string;
  agentName: string;
  dealId: string;
  dealValue: number;
  industryCategory: string;
  commissionAmount: number;
  status: CommissionStatus;
  createdAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  paidAt?: Date;
}

export interface AgentCommissionSummary {
  agentId: string;
  agentName: string;
  count: number;
  totalAmount: number;
  statusBreakdown: Record<CommissionStatus, number>;
}

export interface MonthlyCommissionReport {
  year: number;
  month: number;
  totalCommissions: number;
  totalAmount: number;
  byAgent: AgentCommissionSummary[];
}

let commissionIdCounter = 1;

export class CommissionService {
  /**
   * Calculates commission amount based on deal value and commission rate config.
   */
  calculateCommission(dealValue: number, rate: CommissionRate): number {
    switch (rate.structure) {
      case 'percentage': {
        if (rate.rate === undefined) return 0;
        return dealValue * (rate.rate / 100);
      }
      case 'flat_rate': {
        if (rate.rate === undefined) return 0;
        return rate.rate;
      }
      case 'tiered': {
        if (!rate.tiers || rate.tiers.length === 0) return 0;
        // Find the tier that contains the deal value
        const matchingTier = rate.tiers.find(
          (tier) => dealValue >= tier.minValue && dealValue <= tier.maxValue,
        );
        if (!matchingTier) return 0;
        return dealValue * (matchingTier.rate / 100);
      }
      default:
        return 0;
    }
  }

  /**
   * Creates a new commission record with Pending status.
   */
  createCommission(
    agentId: string,
    agentName: string,
    dealId: string,
    dealValue: number,
    industryCategory: string,
    rates: CommissionRate[],
  ): Commission {
    const matchingRate = rates.find((r) => r.industryCategory === industryCategory);
    const commissionAmount = matchingRate ? this.calculateCommission(dealValue, matchingRate) : 0;

    return {
      id: `comm-${commissionIdCounter++}`,
      agentId,
      agentName,
      dealId,
      dealValue,
      industryCategory,
      commissionAmount,
      status: 'Pending',
      createdAt: new Date(),
    };
  }

  /**
   * Approves a commission — requires CFO/admin approverId.
   */
  approveCommission(commission: Commission, approverId: string): Commission {
    return {
      ...commission,
      status: 'Approved',
      approvedBy: approverId,
      approvedAt: new Date(),
    };
  }

  /**
   * Marks a commission as Paid.
   */
  markAsPaid(commission: Commission): Commission {
    return {
      ...commission,
      status: 'Paid',
      paidAt: new Date(),
    };
  }

  /**
   * Generates a monthly commission report for the given year and month (1-12).
   */
  generateMonthlyReport(commissions: Commission[], year: number, month: number): MonthlyCommissionReport {
    const filtered = commissions.filter((c) => {
      const d = c.createdAt;
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    const agentMap = new Map<string, AgentCommissionSummary>();

    for (const c of filtered) {
      if (!agentMap.has(c.agentId)) {
        agentMap.set(c.agentId, {
          agentId: c.agentId,
          agentName: c.agentName,
          count: 0,
          totalAmount: 0,
          statusBreakdown: { Pending: 0, Approved: 0, Paid: 0, Rejected: 0 },
        });
      }
      const summary = agentMap.get(c.agentId)!;
      summary.count += 1;
      summary.totalAmount += c.commissionAmount;
      summary.statusBreakdown[c.status] += 1;
    }

    const totalAmount = filtered.reduce((sum, c) => sum + c.commissionAmount, 0);

    return {
      year,
      month,
      totalCommissions: filtered.length,
      totalAmount,
      byAgent: Array.from(agentMap.values()),
    };
  }
}
