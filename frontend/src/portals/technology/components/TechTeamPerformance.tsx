import React from 'react';
import { Card } from '../../../shared/components';
import type { TeamPerformance } from '../types';

interface Props {
  members: TeamPerformance[];
}

function kpiColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function kpiBarColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 60) return 'bg-yellow-400';
  return 'bg-red-500';
}

export function TechTeamPerformance({ members }: Props) {
  const sorted = [...members].sort((a, b) => b.kpiScore - a.kpiScore);
  const avgKpi = members.length > 0
    ? Math.round(members.reduce((s, m) => s + m.kpiScore, 0) / members.length)
    : 0;

  return (
    <section aria-label="Technology team performance">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Team Performance</h2>
        <div className="text-sm text-gray-500">
          Avg KPI: <span className={`font-bold ${kpiColor(avgKpi)}`}>{avgKpi}</span>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((member) => {
          const taskPct = member.tasksTotal > 0
            ? Math.round((member.tasksCompleted / member.tasksTotal) * 100)
            : 0;

          return (
            <Card key={member.memberId} variant="elevated" padding="md">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {member.name.charAt(0)}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-semibold text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </div>
                    <span className={`text-xl font-bold ${kpiColor(member.kpiScore)}`}>
                      {member.kpiScore}
                    </span>
                  </div>

                  {/* KPI bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>KPI Score</span>
                      <span>{member.kpiScore}/100</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${kpiBarColor(member.kpiScore)}`}
                        style={{ width: `${member.kpiScore}%` }}
                        role="progressbar"
                        aria-valuenow={member.kpiScore}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${member.name} KPI score`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs text-gray-600">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {member.tasksCompleted}/{member.tasksTotal}
                      </p>
                      <p>Tasks ({taskPct}%)</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{member.attendanceRate}%</p>
                      <p>Attendance</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{member.department}</p>
                      <p>Department</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
