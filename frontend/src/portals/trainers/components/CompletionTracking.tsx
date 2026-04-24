import React from 'react';
import type { CourseAssignment } from '../types';

interface CompletionTrackingProps {
  assignments: CourseAssignment[];
}

export function CompletionTracking({ assignments }: CompletionTrackingProps) {
  const completed = assignments.filter((a) => a.status === 'completed');
  const completionRate = assignments.length > 0
    ? Math.round((completed.length / assignments.length) * 100)
    : 0;

  return (
    <section aria-label="Completion tracking">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Completion Tracking</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Completed</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{completed.length}</p>
          <p className="text-xs text-gray-400 mt-1">of {assignments.length} assignments</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Completion Rate</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{completionRate}%</p>
          <div
            className="w-full bg-gray-200 rounded-full h-2 mt-2"
            role="progressbar"
            aria-valuenow={completionRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall completion rate"
          >
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Completed Assignments</h3>
        </div>
        <table className="w-full text-sm" aria-label="Completed assignments">
          <thead className="border-b border-gray-200">
            <tr>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Agent</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Course</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Assigned</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Completed On</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {completed.map((assignment) => (
              <tr key={assignment.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{assignment.agentName}</td>
                <td className="px-4 py-3 text-gray-700">{assignment.courseName}</td>
                <td className="px-4 py-3 text-gray-500">{assignment.assignedAt}</td>
                <td className="px-4 py-3">
                  <span className="text-green-700 font-medium">{assignment.completedAt ?? '—'}</span>
                </td>
              </tr>
            ))}
            {completed.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No completed assignments yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
