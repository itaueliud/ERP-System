import { CommissionService, CommissionRate, Commission } from './commissionService';

const service = new CommissionService();

const percentageRate: CommissionRate = {
  industryCategory: 'Fintech',
  structure: 'percentage',
  rate: 5,
};

const flatRate: CommissionRate = {
  industryCategory: 'Retail',
  structure: 'flat_rate',
  rate: 2000,
};

const tieredRate: CommissionRate = {
  industryCategory: 'Technology',
  structure: 'tiered',
  tiers: [
    { minValue: 0, maxValue: 50000, rate: 3 },
    { minValue: 50001, maxValue: 200000, rate: 5 },
    { minValue: 200001, maxValue: 1000000, rate: 7 },
  ],
};

describe('CommissionService', () => {
  describe('calculateCommission', () => {
    it('calculates percentage commission correctly', () => {
      const result = service.calculateCommission(100000, percentageRate);
      expect(result).toBe(5000); // 5% of 100,000
    });

    it('calculates flat_rate commission correctly', () => {
      const result = service.calculateCommission(999999, flatRate);
      expect(result).toBe(2000); // flat rate regardless of deal value
    });

    it('calculates tiered commission for lower tier', () => {
      const result = service.calculateCommission(30000, tieredRate);
      expect(result).toBe(900); // 3% of 30,000
    });

    it('calculates tiered commission for middle tier', () => {
      const result = service.calculateCommission(100000, tieredRate);
      expect(result).toBe(5000); // 5% of 100,000
    });

    it('calculates tiered commission for upper tier', () => {
      const result = service.calculateCommission(300000, tieredRate);
      expect(result).toBeCloseTo(21000, 5); // 7% of 300,000
    });

    it('returns 0 for tiered when no tier matches', () => {
      const result = service.calculateCommission(2000000, tieredRate);
      expect(result).toBe(0);
    });
  });

  describe('createCommission', () => {
    it('creates a commission record with Pending status', () => {
      const commission = service.createCommission(
        'agent-1',
        'John Doe',
        'deal-101',
        100000,
        'Fintech',
        [percentageRate],
      );

      expect(commission.agentId).toBe('agent-1');
      expect(commission.agentName).toBe('John Doe');
      expect(commission.dealId).toBe('deal-101');
      expect(commission.dealValue).toBe(100000);
      expect(commission.industryCategory).toBe('Fintech');
      expect(commission.commissionAmount).toBe(5000);
      expect(commission.status).toBe('Pending');
      expect(commission.createdAt).toBeInstanceOf(Date);
      expect(commission.approvedBy).toBeUndefined();
      expect(commission.approvedAt).toBeUndefined();
      expect(commission.paidAt).toBeUndefined();
    });

    it('sets commissionAmount to 0 when no matching rate found', () => {
      const commission = service.createCommission(
        'agent-2',
        'Jane Smith',
        'deal-102',
        50000,
        'Healthcare',
        [percentageRate], // no Healthcare rate
      );
      expect(commission.commissionAmount).toBe(0);
    });
  });

  describe('approveCommission', () => {
    it('sets status to Approved and records approverId', () => {
      const commission = service.createCommission(
        'agent-1',
        'John Doe',
        'deal-103',
        100000,
        'Fintech',
        [percentageRate],
      );

      const approved = service.approveCommission(commission, 'cfo-001');

      expect(approved.status).toBe('Approved');
      expect(approved.approvedBy).toBe('cfo-001');
      expect(approved.approvedAt).toBeInstanceOf(Date);
      // original unchanged
      expect(commission.status).toBe('Pending');
    });
  });

  describe('markAsPaid', () => {
    it('sets status to Paid and records paidAt', () => {
      const commission = service.createCommission(
        'agent-1',
        'John Doe',
        'deal-104',
        100000,
        'Fintech',
        [percentageRate],
      );
      const approved = service.approveCommission(commission, 'cfo-001');
      const paid = service.markAsPaid(approved);

      expect(paid.status).toBe('Paid');
      expect(paid.paidAt).toBeInstanceOf(Date);
      // original unchanged
      expect(approved.status).toBe('Approved');
    });
  });

  describe('generateMonthlyReport', () => {
    const makeCommission = (
      agentId: string,
      agentName: string,
      amount: number,
      status: Commission['status'],
      year: number,
      month: number,
    ): Commission => ({
      id: `test-${Math.random()}`,
      agentId,
      agentName,
      dealId: `deal-${Math.random()}`,
      dealValue: amount * 20,
      industryCategory: 'Fintech',
      commissionAmount: amount,
      status,
      createdAt: new Date(year, month - 1, 15),
    });

    it('returns correct totals for the month', () => {
      const commissions: Commission[] = [
        makeCommission('a1', 'Alice', 1000, 'Paid', 2024, 7),
        makeCommission('a1', 'Alice', 2000, 'Approved', 2024, 7),
        makeCommission('a2', 'Bob', 1500, 'Pending', 2024, 7),
        makeCommission('a1', 'Alice', 500, 'Paid', 2024, 6), // different month
      ];

      const report = service.generateMonthlyReport(commissions, 2024, 7);

      expect(report.year).toBe(2024);
      expect(report.month).toBe(7);
      expect(report.totalCommissions).toBe(3);
      expect(report.totalAmount).toBe(4500);
      expect(report.byAgent).toHaveLength(2);
    });

    it('aggregates per-agent totals and status breakdown', () => {
      const commissions: Commission[] = [
        makeCommission('a1', 'Alice', 1000, 'Paid', 2024, 8),
        makeCommission('a1', 'Alice', 2000, 'Pending', 2024, 8),
      ];

      const report = service.generateMonthlyReport(commissions, 2024, 8);
      const alice = report.byAgent.find((a) => a.agentId === 'a1')!;

      expect(alice.count).toBe(2);
      expect(alice.totalAmount).toBe(3000);
      expect(alice.statusBreakdown.Paid).toBe(1);
      expect(alice.statusBreakdown.Pending).toBe(1);
      expect(alice.statusBreakdown.Approved).toBe(0);
    });

    it('returns empty report when no commissions in that month', () => {
      const report = service.generateMonthlyReport([], 2024, 1);
      expect(report.totalCommissions).toBe(0);
      expect(report.totalAmount).toBe(0);
      expect(report.byAgent).toHaveLength(0);
    });
  });
});
