import React from 'react';
import { Card } from '../../../shared/components';
import type { FinancialSummary } from '../types';

interface FinancialSummaryProps {
  summary: FinancialSummary;
  role: string;
}

interface SummaryCardProps {
  title: string;
  count: number;
  value: number;
  currency: string;
  accentClass: string;
  countLabel: string;
}

function SummaryCard({ title, count, value, currency, accentClass, countLabel }: SummaryCardProps) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

  return (
    <Card variant="elevated" padding="md">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        <span className={`text-2xl font-bold ${accentClass}`} aria-label={`${title}: ${count} ${countLabel}`}>
          {count}
        </span>
        <span className="text-sm text-gray-600">{formatted} total value</span>
        <span className="text-xs text-gray-400">{countLabel}</span>
      </div>
    </Card>
  );
}

export function FinancialSummaryOverview({ summary, role }: FinancialSummaryProps) {
  return (
    <section aria-label="Financial summary overview">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Financial Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(role === 'CFO' || role === 'CoS') && (
          <SummaryCard
            title="Pending Approvals"
            count={summary.totalPendingApprovals}
            value={summary.totalPendingValue}
            currency={summary.currency}
            accentClass="text-orange-600"
            countLabel="awaiting CFO approval"
          />
        )}
        {(role === 'EA' || role === 'CoS') && (
          <SummaryCard
            title="Approved – Pending Execution"
            count={summary.totalApprovedPendingExecution}
            value={summary.totalApprovedValue}
            currency={summary.currency}
            accentClass="text-blue-600"
            countLabel="ready for EA execution"
          />
        )}
        <SummaryCard
          title="Executed This Month"
          count={summary.totalExecutedThisMonth}
          value={summary.totalExecutedValue}
          currency={summary.currency}
          accentClass="text-green-600"
          countLabel="payments processed"
        />
      </div>
    </section>
  );
}

export default FinancialSummaryOverview;
