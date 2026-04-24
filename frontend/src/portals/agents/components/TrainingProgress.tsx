import React from 'react';
import type { TrainingAssignment } from '../types';

interface TrainingProgressProps {
  assignments: TrainingAssignment[];
}

const STATUS_STYLES: Record<TrainingAssignment['status'], { badge: string; label: string }> = {
  'not-started': { badge: 'bg-gray-100 text-gray-600', label: 'Not Started' },
  'in-progress': { badge: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  completed: { badge: 'bg-green-100 text-green-700', label: 'Completed' },
};

const BAR_COLORS: Record<TrainingAssignment['status'], string> = {
  'not-started': 'bg-gray-300',
  'in-progress': 'bg-blue-500',
  completed: 'bg-green-500',
};

export function TrainingProgress({ assignments }: TrainingProgressProps) {
  const completed = assignments.filter((a) => a.status === 'completed').length;

  return (
    <section aria-label="Training progress">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Training</h2>
        <span className="text-sm text-gray-500">{completed}/{assignments.length} completed</span>
      </div>

      <div className="space-y-4">
        {assignments.map((assignment) => {
          const style = STATUS_STYLES[assignment.status];
          const barColor = BAR_COLORS[assignment.status];

          return (
            <div
              key={assignment.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="font-medium text-gray-900">{assignment.courseName}</p>
                <span className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${style.badge}`}>
                  {style.label}
                </span>
              </div>

              <div
                className="w-full bg-gray-200 rounded-full h-2 mb-3"
                role="progressbar"
                aria-valuenow={assignment.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${assignment.courseName} progress`}
              >
                <div
                  className={`${barColor} h-2 rounded-full transition-all`}
                  style={{ width: `${assignment.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{assignment.progress}% complete</span>
                <span>Due: {assignment.dueDate}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
