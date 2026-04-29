import type { AgentPerformance } from '../types';

interface AgentPerformanceDashboardProps {
  performance: AgentPerformance;
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function ProgressBar({ value, color = 'bg-blue-500' }: { value: number; color?: string }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`${color} h-2.5 rounded-full`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export function AgentPerformanceDashboard({ performance }: AgentPerformanceDashboardProps) {
  const kpiColor =
    performance.kpiScore >= 80
      ? 'text-green-600'
      : performance.kpiScore >= 60
      ? 'text-yellow-600'
      : 'text-red-600';

  return (
    <section aria-label="Performance dashboard">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">My Performance</h2>

      {/* KPI highlight */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-center gap-6">
        <div className="text-center">
          <p className={`text-5xl font-bold ${kpiColor}`}>{performance.kpiScore}</p>
          <p className="text-sm text-gray-500 mt-1">KPI Score</p>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Closed Deals</p>
            <p className="text-2xl font-bold text-gray-900">{performance.closedDeals}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Clients</p>
            <p className="text-2xl font-bold text-gray-900">{performance.totalClients}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Leads</p>
            <p className="text-2xl font-bold text-blue-600">{performance.activeLeads}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Commissions</p>
            <p className="text-2xl font-bold text-green-600">{fmt.format(performance.totalCommissions)}</p>
          </div>
        </div>
      </div>

      {/* Detailed metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Attendance Rate</p>
            <p className="text-sm font-bold text-gray-900">{performance.attendanceRate}%</p>
          </div>
          <ProgressBar
            value={performance.attendanceRate}
            color={performance.attendanceRate >= 90 ? 'bg-green-500' : 'bg-yellow-500'}
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Training Progress</p>
            <p className="text-sm font-bold text-gray-900">{performance.trainingProgress}%</p>
          </div>
          <ProgressBar value={performance.trainingProgress} color="bg-blue-500" />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Pending Commissions</p>
          <p className="text-xl font-bold text-yellow-600 mt-1">{fmt.format(performance.pendingCommissions)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Earned</p>
          <p className="text-xl font-bold text-green-600 mt-1">{fmt.format(performance.totalCommissions)}</p>
        </div>
      </div>
    </section>
  );
}
