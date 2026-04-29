import React, { useState } from 'react';
import { Card, Table } from '../../../shared/components';
import type { TableColumn } from '../../../shared/components';
import type { DepartmentMetrics } from '../types';

interface Props {
  departments: DepartmentMetrics[];
}

export function DepartmentManagement({ departments }: Props) {
  const [filter, setFilter] = useState('');

  const filtered = departments.filter((d) =>
    d.name.toLowerCase().includes(filter.toLowerCase())
  );

  const columns: TableColumn<DepartmentMetrics>[] = [
    { key: 'name', header: 'Department', render: (_v, d) => <span className="font-medium">{d.name}</span> },
    { key: 'headCount', header: 'Head Count', render: (_v, d) => d.headCount },
    { key: 'activeProjects', header: 'Active Projects', render: (_v, d) => d.activeProjects },
    {
      key: 'completionRate',
      header: 'Completion Rate',
      render: (_v, d) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
            <div
              className={`h-2 rounded-full ${d.completionRate >= 80 ? 'bg-green-500' : d.completionRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${d.completionRate}%` }}
            />
          </div>
          <span className="text-sm">{d.completionRate}%</span>
        </div>
      ),
    },
    {
      key: 'budget',
      header: 'Budget Usage',
      render: (_v, d) => {
        const pct = Math.round((d.budgetUsed / d.budget) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
              <div
                className={`h-2 rounded-full ${pct <= 80 ? 'bg-blue-500' : pct <= 95 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm">{pct}%</span>
          </div>
        );
      },
    },
    {
      key: 'kpiScore',
      header: 'KPI Score',
      render: (_v, d) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            d.kpiScore >= 85 ? 'bg-green-100 text-green-800' : d.kpiScore >= 70 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {d.kpiScore}
        </span>
      ),
    },
  ];

  return (
    <section aria-label="Department management">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Department Management</h2>
      <div className="mb-4">
        <input
          type="search"
          placeholder="Filter departments..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter departments"
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Departments', value: departments.length },
          { label: 'Total Head Count', value: departments.reduce((s, d) => s + d.headCount, 0) },
          { label: 'Avg KPI Score', value: Math.round(departments.reduce((s, d) => s + d.kpiScore, 0) / departments.length) },
          { label: 'Active Projects', value: departments.reduce((s, d) => s + d.activeProjects, 0) },
        ].map((stat) => (
          <Card key={stat.label} variant="elevated" padding="md">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>
      <Card variant="elevated" padding="none">
        <Table data={filtered} columns={columns} aria-label="Departments table" />
      </Card>
    </section>
  );
}
