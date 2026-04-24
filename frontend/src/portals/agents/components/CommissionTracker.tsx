import React from 'react';
import type { AgentCommission } from '../types';

interface CommissionTrackerProps {
  commissions: AgentCommission[];
}

const STATUS_COLORS: Record<AgentCommission['status'], string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
};

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function CommissionTracker({ commissions }: CommissionTrackerProps) {
  const totalEarned = commissions
    .filter((c) => c.status === 'Paid')
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  const totalApproved = commissions
    .filter((c) => c.status === 'Approved')
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  const totalPending = commissions
    .filter((c) => c.status === 'Pending')
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  return (
    <section aria-label="Commission tracker">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Commission Tracker</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium">Total Earned (Paid)</p>
          <p className="text-2xl font-bold text-green-800 mt-1">{fmt.format(totalEarned)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 font-medium">Approved</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{fmt.format(totalApproved)}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700 font-medium">Pending</p>
          <p className="text-2xl font-bold text-yellow-800 mt-1">{fmt.format(totalPending)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Commission details">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Deal Value</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Rate</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Commission</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commissions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.clientName}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt.format(c.dealValue)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{c.commissionRate}%</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {fmt.format(c.commissionAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[c.status]}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.dealClosedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
