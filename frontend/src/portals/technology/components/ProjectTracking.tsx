import React, { useState } from 'react';
import { Card } from '../../../shared/components';
import type { Project } from '../types';

interface Props {
  projects: Project[];
}

const STATUS_STYLES: Record<Project['status'], string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  'on-hold': 'bg-yellow-100 text-yellow-700',
};

const STATUS_LABELS: Record<Project['status'], string> = {
  active: 'Active',
  completed: 'Completed',
  'on-hold': 'On Hold',
};

type FilterStatus = 'all' | Project['status'];

export function ProjectTracking({ projects }: Props) {
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered = filter === 'all' ? projects : projects.filter((p) => p.status === filter);

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'on-hold', label: 'On Hold' },
  ];

  return (
    <section aria-label="Project tracking">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Project Tracking</h2>
        <div className="flex gap-2" role="group" aria-label="Filter by status">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              aria-pressed={filter === opt.value}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((project) => (
          <Card key={project.id} variant="elevated" padding="md">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 text-sm">{project.name}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[project.status]}`}>
                {STATUS_LABELS[project.status]}
              </span>
            </div>

            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{project.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className={`h-2 rounded-full transition-all ${
                    project.progress === 100 ? 'bg-blue-500' : project.status === 'on-hold' ? 'bg-yellow-400' : 'bg-green-500'
                  }`}
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            {/* Tech stack */}
            <div className="flex flex-wrap gap-1 mb-3">
              {project.techStack.map((tech) => (
                <span key={tech} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {tech}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>👥 {project.teamSize} members</span>
              <span>🎯 {new Date(project.targetDate).toLocaleDateString()}</span>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-12">No projects match the selected filter.</p>
      )}
    </section>
  );
}
