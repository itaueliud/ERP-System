import React from 'react';
import type { AgentTrainingRecord } from '../types';

interface AgentPerformanceViewProps {
  agents: AgentTrainingRecord[];
}

function CompletionBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-blue-500' : 'bg-yellow-500';
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 bg-gray-200 rounded-full h-2"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${value}% average progress`}
      >
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{value}%</span>
    </div>
  );
}

export function AgentPerformanceView({ agents }: AgentPerformanceViewProps) {
  const sorted = [...agents].sort((a, b) => {
    const rateA = a.totalAssigned > 0 ? (a.completed / a.totalAssigned) * 100 : 0;
    const rateB = b.totalAssigned > 0 ? (b.completed / b.totalAssigned) * 100 : 0;
    return rateB - rateA;
  });

  return (
    <section aria-label="Agent performance">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Agent Performance</h2>
        <span className="text-xs text-gray-500">Sorted by completion rate</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm" aria-label="Agent training records">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Agent</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Assigned</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Completed</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">In Progress</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Overdue</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide w-40">Avg Progress</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">KPI Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((agent) => {
              const completionRate = agent.totalAssigned > 0
                ? Math.round((agent.completed / agent.totalAssigned) * 100)
                : 0;
              const kpiColor = agent.kpiScore >= 85 ? 'text-green-700' : agent.kpiScore >= 70 ? 'text-blue-700' : 'text-yellow-700';

              return (
                <tr key={agent.agentId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{agent.agentName}</p>
                      <p className="text-xs text-gray-500">{completionRate}% completion rate</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{agent.totalAssigned}</td>
                  <td className="px-4 py-3 text-green-700 font-medium">{agent.completed}</td>
                  <td className="px-4 py-3 text-blue-700">{agent.inProgress}</td>
                  <td className="px-4 py-3">
                    {agent.overdue > 0 ? (
                      <span className="text-red-600 font-medium">{agent.overdue}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CompletionBar value={agent.avgProgress} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${kpiColor}`}>{agent.kpiScore}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
