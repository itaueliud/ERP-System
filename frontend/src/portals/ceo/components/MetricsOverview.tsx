import React from 'react';
import { Card, ArrowUpIcon, ArrowDownIcon } from '../../../shared/components';
import type { CompanyMetrics } from '../types';

interface MetricsOverviewProps {
  metrics: CompanyMetrics;
}

interface KPICardProps {
  title: string;
  value: string;
  change: number;
  description: string;
}

function KPICard({ title, value, change, description }: KPICardProps) {
  const isPositive = change >= 0;
  return (
    <Card variant="elevated" padding="md" className="flex-1 min-w-[200px]">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        <span className="text-2xl font-bold text-gray-900" aria-label={`${title}: ${value}`}>
          {value}
        </span>
        <span
          className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}
          aria-label={`${isPositive ? 'Up' : 'Down'} ${Math.abs(change)}% ${description}`}
        >
          {isPositive ? (
            <ArrowUpIcon size="sm" aria-hidden />
          ) : (
            <ArrowDownIcon size="sm" aria-hidden />
          )}
          {Math.abs(change)}% {description}
        </span>
      </div>
    </Card>
  );
}

export function MetricsOverview({ metrics }: MetricsOverviewProps) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);

  return (
    <section aria-label="Company KPI metrics">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Company Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          change={metrics.revenueChange}
          description="vs last month"
        />
        <KPICard
          title="Active Clients"
          value={String(metrics.activeClients)}
          change={metrics.clientsChange}
          description="vs last month"
        />
        <KPICard
          title="Active Projects"
          value={String(metrics.activeProjects)}
          change={metrics.projectsChange}
          description="vs last month"
        />
        <Card variant="elevated" padding="md" className="flex-1 min-w-[200px]">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-500 font-medium">Pending Approvals</span>
            <span
              className="text-2xl font-bold text-orange-600"
              aria-label={`Pending Approvals: ${metrics.pendingApprovalsCount}`}
            >
              {metrics.pendingApprovalsCount}
            </span>
            <span className="text-sm text-orange-500">Requires attention</span>
          </div>
        </Card>
      </div>
    </section>
  );
}

export default MetricsOverview;
