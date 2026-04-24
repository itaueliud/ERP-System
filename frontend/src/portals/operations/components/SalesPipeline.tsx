import React from 'react';
import type { Lead, LeadStage } from '../types';

interface SalesPipelineProps {
  leads: Lead[];
}

const PIPELINE_STAGES: LeadStage[] = [
  'Prospect',
  'Lead',
  'Qualified_Lead',
  'Proposal',
  'Negotiation',
  'Closed_Won',
];

const stageColors: Record<string, string> = {
  Prospect: 'bg-gray-200',
  Lead: 'bg-blue-200',
  Qualified_Lead: 'bg-indigo-200',
  Proposal: 'bg-yellow-200',
  Negotiation: 'bg-orange-200',
  Closed_Won: 'bg-green-200',
};

const stageHeaderColors: Record<string, string> = {
  Prospect: 'bg-gray-400 text-white',
  Lead: 'bg-blue-500 text-white',
  Qualified_Lead: 'bg-indigo-500 text-white',
  Proposal: 'bg-yellow-500 text-white',
  Negotiation: 'bg-orange-500 text-white',
  Closed_Won: 'bg-green-500 text-white',
};

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function SalesPipeline({ leads: allLeads }: SalesPipelineProps) {
  const activeLeads = allLeads.filter((l) => l.stage !== 'Closed_Lost');

  const stageData = PIPELINE_STAGES.map((stage) => {
    const stageLeads = activeLeads.filter((l) => l.stage === stage);
    const totalValue = stageLeads.reduce((sum, l) => sum + l.value, 0);
    return { stage, count: stageLeads.length, totalValue, leads: stageLeads };
  });

  const totalPipelineValue = activeLeads.reduce((sum, l) => sum + l.value, 0);
  const closedWon = allLeads.filter((l) => l.stage === 'Closed_Won');
  const closedLost = allLeads.filter((l) => l.stage === 'Closed_Lost');
  const totalClosed = closedWon.length + closedLost.length;
  const conversionRate = totalClosed > 0 ? Math.round((closedWon.length / totalClosed) * 100) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Sales Pipeline</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Pipeline Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalPipelineValue)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active Leads</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{activeLeads.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Closed Won</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{closedWon.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Conversion Rate</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{conversionRate}%</p>
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-2">
          {stageData.map((s, idx) => (
            <div key={s.stage} className="w-44 flex flex-col">
              {/* Stage header */}
              <div className={`rounded-t-lg px-3 py-2 ${stageHeaderColors[s.stage]}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">{s.stage.replace('_', ' ')}</p>
                <p className="text-sm font-bold mt-0.5">{s.count} leads</p>
                <p className="text-xs opacity-90">{formatCurrency(s.totalValue)}</p>
              </div>

              {/* Conversion rate arrow */}
              {idx < stageData.length - 1 && (
                <div className="hidden" aria-hidden="true" />
              )}

              {/* Lead cards */}
              <div className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-24 ${stageColors[s.stage]}`}>
                {s.leads.map((lead) => (
                  <div key={lead.id} className="bg-white rounded p-2 shadow-sm text-xs">
                    <p className="font-medium text-gray-800 truncate">{lead.clientName}</p>
                    <p className="text-gray-500 truncate">{lead.company}</p>
                    <p className="text-green-700 font-semibold mt-1">{formatCurrency(lead.value)}</p>
                  </div>
                ))}
                {s.leads.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion rates between stages */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Stage Conversion Rates</h3>
        <div className="flex flex-wrap gap-4">
          {stageData.slice(0, -1).map((s, idx) => {
            const next = stageData[idx + 1];
            const rate = s.count > 0 ? Math.round((next.count / s.count) * 100) : 0;
            return (
              <div key={`${s.stage}->${next.stage}`} className="text-sm text-gray-600">
                <span className="font-medium">{s.stage.replace('_', ' ')}</span>
                <span className="mx-1 text-gray-400">→</span>
                <span className="font-medium">{next.stage.replace('_', ' ')}</span>
                <span className="ml-2 text-blue-600 font-semibold">{rate}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
