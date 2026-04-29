import React, { useState } from 'react';
import { Card, Table } from '../../../shared/components';
import type { TableColumn } from '../../../shared/components';
import type { TeamPerformance } from '../types';

interface Props {
  members: TeamPerformance[];
}

export function TeamPerformanceMetrics({ members }: Props) {
  const [deptFilter, setDeptFilter] = useState('All');
  const departments = ['All', ...Array.from(new Set(members.map((m) => m.department)))];

  const filtered = deptFilter === 'All' ? members : members.filter((m) => m.department === deptFilter);
  const sorted = [...filtered].sort((a, b) => b.kpiScore - a.kpiScore);

  const columns: TableColumn<TeamPerformance>[] = [
    { key: 'name', header: 'Name', render: (_v, m) => <span className="font-medium">{m.name}</span> },
    { key: 'role', header: 'Role', render: (_v, m) => m.role },
    { key: 'department', header: 'Department', render: (_v, m) => m.department },
    {
      key: 'kpiScore',
      header: 'KPI Score',
      render: (_v, m) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${m.kpiScore >= 85 ? 'bg-green-100 text-green-800' : m.kpiScore >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
          {m.kpiScore}
        </span>
      ),
    },
    {
      key: 'tasksCompleted',
      header: 'Tasks',
      render: (_v, m) => (
        <span>{m.tasksCompleted}/{m.tasksTotal}</span>
      ),
    },
    {
      key: 'attendanceRate',
      header: 'Attendance',
      render: (_v, m) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${m.attendanceRate}%` }} />
          </div>
          <span className="text-sm">{m.attendanceRate}%</span>
        </div>
      ),
    },
  ];

  const avgKpi = Math.round(filtered.reduce((s, m) => s + m.kpiScore, 0) / (filtered.length || 1));

  return (
    <section aria-label="Team performance metrics">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Team Performance</h2>

      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by department">
        {departments.map((d) => (
          <button
            key={d}
            onClick={() => setDeptFilter(d)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${deptFilter === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Team Members</p>
          <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Avg KPI Score</p>
          <p className={`text-2xl font-bold ${avgKpi >= 85 ? 'text-green-600' : avgKpi >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{avgKpi}</p>
        </Card>
        <Card variant="elevated" padding="md">
          <p className="text-sm text-gray-500">Avg Attendance</p>
          <p className="text-2xl font-bold text-blue-600">
            {Math.round(filtered.reduce((s, m) => s + m.attendanceRate, 0) / (filtered.length || 1))}%
          </p>
        </Card>
      </div>

      <Card variant="elevated" padding="none">
        <Table<TeamPerformance> data={sorted} columns={columns} rowKey="memberId" aria-label="Team performance table" />
      </Card>
    </section>
  );
}
