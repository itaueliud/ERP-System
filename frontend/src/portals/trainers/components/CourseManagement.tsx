import React, { useState } from 'react';
import type { Course } from '../types';

interface CourseManagementProps {
  courses: Course[];
}

type StatusFilter = 'all' | Course['status'];

const STATUS_STYLES: Record<Course['status'], string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<Course['status'], string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

export function CourseManagement({ courses }: CourseManagementProps) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', category: '' });

  const filtered = filter === 'all' ? courses : courses.filter((c) => c.status === filter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowForm(false);
    setFormData({ title: '', description: '', category: '' });
  };

  return (
    <section aria-label="Course management">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Courses</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {showForm ? 'Cancel' : 'Create Course'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-blue-200 rounded-lg p-4 mb-6 space-y-3"
          aria-label="Create course form"
        >
          <h3 className="text-sm font-semibold text-gray-700">New Course</h3>
          <div>
            <label htmlFor="course-title" className="block text-xs font-medium text-gray-600 mb-1">
              Title
            </label>
            <input
              id="course-title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Course title"
            />
          </div>
          <div>
            <label htmlFor="course-description" className="block text-xs font-medium text-gray-600 mb-1">
              Description
            </label>
            <textarea
              id="course-description"
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description"
            />
          </div>
          <div>
            <label htmlFor="course-category" className="block text-xs font-medium text-gray-600 mb-1">
              Category
            </label>
            <input
              id="course-category"
              type="text"
              value={formData.category}
              onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Sales, Compliance, Technology"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save Course
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4" role="group" aria-label="Filter courses by status">
        {(['all', 'active', 'draft', 'archived'] as const).map((s) => (
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
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-medium text-gray-900 text-sm leading-snug">{course.title}</h3>
              <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[course.status]}`}>
                {STATUS_LABELS[course.status]}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{course.description}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{course.modules.length} module{course.modules.length !== 1 ? 's' : ''}</span>
              <span>{course.totalDuration}h total</span>
            </div>
            <div className="mt-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{course.category}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-gray-500 text-center py-8">No courses found.</p>
        )}
      </div>
    </section>
  );
}
