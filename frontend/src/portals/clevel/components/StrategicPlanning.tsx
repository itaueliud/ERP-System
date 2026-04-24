import React from 'react';
import { Card } from '../../../shared/components';
import type { StrategicGoal } from '../types';

interface Props {
  goals: StrategicGoal[];
}

const STATUS_STYLES: Record<StrategicGoal['status'], string> = {
  'on-track': 'bg-green-100 text-green-800',
  'at-risk': 'bg-yellow-100 text-yellow-800',
  'behind': 'bg-red-100 text-red-800',
  'completed': 'bg-blue-100 text-blue-800',
};

const STATUS_BAR: Record<StrategicGoal['status'], string> = {
  'on-track': 'bg-green-500',
  'at-risk': 'bg-yellow-500',
  'behind': 'bg-red-500',
  'completed': 'bg-blue-500',
};

export function StrategicPlanning({ goals }: Props) {
  const summary = {
    total: goals.length,
    onTrack: goals.filter((g) => g.status === 'on-track').length,
    atRisk: goals.filter((g) => g.status === 'at-risk').length,
    behind: goals.filter((g) => g.status === 'behind').length,
    completed: goals.filter((g) => g.status === 'completed').length,
  };

  return (
    <section aria-label="Strategic planning tools">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Strategic Planning</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'On Track', value: summary.onTrack, color: 'text-green-600' },
          { label: 'At Risk', value: summary.atRisk, color: 'text-yellow-600' },
          { label: 'Behind', value: summary.behind, color: 'text-red-600' },
          { label: 'Completed', value: summary.completed, color: 'text-blue-600' },
        ].map((s) => (
          <Card key={s.label} variant="elevated" padding="md">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {goals.map((goal) => (
          <Card key={goal.id} variant="elevated" padding="md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[goal.status]}`}>
                    {goal.status.replace('-', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${STATUS_BAR[goal.status]}`}
                      style={{ width: `${goal.progress}%` }}
                      role="progressbar"
                      aria-valuenow={goal.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${goal.title} progress: ${goal.progress}%`}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-10 text-right">{goal.progress}%</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Owner: <span className="font-medium text-gray-700">{goal.owner}</span></span>
                  <span>Dept: <span className="font-medium text-gray-700">{goal.department}</span></span>
                  <span>Target: <span className="font-medium text-gray-700">{new Date(goal.targetDate).toLocaleDateString()}</span></span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
