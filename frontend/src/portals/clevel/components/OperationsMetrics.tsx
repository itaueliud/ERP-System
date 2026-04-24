import React from 'react';
import { Card, ArrowUpIcon, ArrowDownIcon } from '../../../shared/components';
import type { OperationsMetric } from '../types';

interface Props {
  metrics: OperationsMetric[];
}

const STATUS_COLORS: Record<OperationsMetric['status'], string> = {
  good: 'border-l-green-500',
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
};

export function OperationsMetrics({ metrics }: Props) {
  return (
    <section aria-label="Operations metrics for COO">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Operations Metrics (COO View)</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card
            key={m.label}
            variant="elevated"
            padding="md"
            className={`border-l-4 ${STATUS_COLORS[m.status]}`}
          >
            <p className="text-sm text-gray-500 mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-gray-900">
              {m.value}{m.unit ? <span className="text-base font-normal text-gray-500 ml-1">{m.unit}</span> : null}
            </p>
            {m.change !== undefined && (
              <p className={`flex items-center gap-1 text-sm mt-1 ${m.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {m.change >= 0 ? <ArrowUpIcon size="sm" aria-hidden /> : <ArrowDownIcon size="sm" aria-hidden />}
                {Math.abs(m.change)}{m.unit === '%' ? 'pp' : ''} vs last month
              </p>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
