import React, { useState } from 'react';
import type { Lead, LeadStage } from '../types';

interface LeadManagementProps {
  leads: Lead[];
}

const STAGES: LeadStage[] = [
  'Prospect',
  'Lead',
  'Qualified_Lead',
  'Proposal',
  'Negotiation',
  'Closed_Won',
  'Closed_Lost',
];

const stageColors: Record<LeadStage, string> = {
  Prospect: 'bg-gray-100 text-gray-700',
  Lead: 'bg-blue-100 text-blue-700',
  Qualified_Lead: 'bg-indigo-100 text-indigo-700',
  Proposal: 'bg-yellow-100 text-yellow-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Closed_Won: 'bg-green-100 text-green-700',
  Closed_Lost: 'bg-red-100 text-red-700',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function LeadManagement({ leads }: LeadManagementProps) {
  const [stageFilter, setStageFilter] = useState<string>('All');

  const stageCounts = STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = leads.filter((l) => l.stage === s).length;
    return acc;
  }, {});

  const filtered = stageFilter === 'All' ? leads : leads.filter((l) => l.stage === stageFilter);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Lead Management</h2>

      {/* Stage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stageFilter === stage ? 'All' : stage)}
            className={`rounded-lg border p-3 text-center transition-colors ${
              stageFilter === stage ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
            } bg-white`}
            aria-pressed={stageFilter === stage}
          >
            <p className="text-xl font-bold text-gray-900">{stageCounts[stage]}</p>
            <p className="text-xs text-gray-500 mt-1">{stage.replace('_', ' ')}</p>
          </button>
        ))}
      </div>

      {/* Filter indicator */}
      {stageFilter !== 'All' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Showing: <strong>{stageFilter.replace('_', ' ')}</strong></span>
          <button
            onClick={() => setStageFilter('All')}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Client', 'Company', 'Stage', 'Value', 'Agent', 'Last Contact'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No leads found</td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div>{lead.clientName}</div>
                    <div className="text-xs text-gray-400">{lead.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.company}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stageColors[lead.stage]}`}>
                      {lead.stage.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(lead.value)}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.assignedAgent}</td>
                  <td className="px-4 py-3 text-gray-500">{lead.lastContact}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
