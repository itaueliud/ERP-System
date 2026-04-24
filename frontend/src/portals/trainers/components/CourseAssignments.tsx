import React, { useState } from 'react';
import type { CourseAssignment } from '../types';

interface CourseAssignmentsProps {
  assignments: CourseAssignment[];
}

type StatusFilter = 'all' | CourseAssignment['status'];

const STATUS_STYLES: Record<CourseAssignment['status'], string> = {
  'not-started': 'bg-gray-100 text-gray-600',
  'in-progress': 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<CourseAssignment['status'], string> = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  completed: 'Completed',
};

const BAR_COLORS: Record<CourseAssignment['status'], string> = {
  'not-started': 'bg-gray-300',
  'in-progress': 'bg-blue-500',
  completed: 'bg-green-500',
};

export function CourseAssignments({ assignments }: CourseAssignmentsProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered = filter === 'all' ? assignments : assignments.filter((a) => a.status === filter);

  return (
    <section aria-label="Course assignments">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Assignments</h2>
      </div>

      <div className="flex gap-2 mb-4" role="group" aria-label="Filter assignments by status">
        {(['all', 'not-started', 'in-progress', 'completed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              filter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={filter === s}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s as CourseAssignment['status']]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm" aria-label="Assignments table">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Agent</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Course</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide w-36">Progress</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((assignment) => (
              <tr key={assignment.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{assignment.agentName}</td>
                <td className="px-4 py-3 text-gray-700">{assignment.courseName}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 bg-gray-200 rounded-full h-2"
                      role="progressbar"
                      aria-valuenow={assignment.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${assignment.agentName} progress on ${assignment.courseName}`}
                    >
                      <div
                        className={`${BAR_COLORS[assignment.status]} h-2 rounded-full transition-all`}
                        style={{ width: `${assignment.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{assignment.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[assignment.status]}`}>
                    {STATUS_LABELS[assignment.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{assignment.dueDate}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No assignments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
