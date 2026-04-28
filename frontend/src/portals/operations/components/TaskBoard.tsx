import { useState, useEffect } from 'react';
import { PortalButton, SectionHeader, StatusBadge } from '../../../shared/components/layout/PortalLayout';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
}

const COLUMNS = [
  { id: 'PENDING', label: 'To Do', color: '#94a3b8' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6' },
  { id: 'COMPLETED', label: 'Done', color: '#22c55e' },
  { id: 'CANCELLED', label: 'Cancelled', color: '#ef4444' },
];

export default function TaskBoard({ themeHex }: { themeHex: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: ''
  });
  const [users, setUsers] = useState<any[]>([]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/tasks');
      setTasks(res.data?.tasks || res.data?.data || res.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      const res = await apiClient.get('/api/v1/users');
      setUsers(res.data?.users || res.data?.data || res.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => { loadTasks(); loadUsers(); }, []);

  const handleCreateTask = async () => {
    if (!form.title) return;
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post('/api/v1/tasks', {
        ...form,
        dueDate: form.dueDate || undefined,
        assignedTo: form.assignedTo || undefined
      });
      setForm({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: '' });
      setShowForm(false);
      loadTasks();
    } catch { /* silent */ }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.patch(`/api/v1/tasks/${taskId}/status`, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch { /* silent */ }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-700';
      case 'HIGH': return 'bg-orange-100 text-orange-700';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
      case 'LOW': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div>
      <SectionHeader
        title="Task Board"
        subtitle="Kanban-style task management"
        action={
          <PortalButton color={themeHex} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New Task'}
          </PortalButton>
        }
      />

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign To</label>
              <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <PortalButton color={themeHex} fullWidth onClick={handleCreateTask}>Create Task</PortalButton>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading tasks...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(column => (
            <div key={column.id} className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">{column.label}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-white text-gray-600">
                  {tasks.filter(t => t.status === column.id).length}
                </span>
              </div>
              <div className="space-y-3">
                {tasks
                  .filter(t => t.status === column.id)
                  .map(task => (
                    <div
                      key={task.id}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-800 text-sm flex-1">{task.title}</h4>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{task.assignedToName || 'Unassigned'}</span>
                        {task.dueDate && (
                          <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Task Details</h3>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">{selectedTask.title}</h2>
              {selectedTask.description && (
                <p className="text-gray-700 mb-4">{selectedTask.description}</p>
              )}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Priority</p>
                  <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${getPriorityColor(selectedTask.priority)}`}>
                    {selectedTask.priority}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <StatusBadge status={selectedTask.status} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Assigned To</p>
                  <p className="text-sm text-gray-700">{selectedTask.assignedToName || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Due Date</p>
                  <p className="text-sm text-gray-700">
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Move to:</p>
                <div className="flex gap-2 flex-wrap">
                  {COLUMNS.filter(c => c.id !== selectedTask.status).map(column => (
                    <PortalButton
                      key={column.id}
                      size="sm"
                      color={column.color}
                      onClick={() => {
                        updateTaskStatus(selectedTask.id, column.id);
                        setSelectedTask(null);
                      }}
                    >
                      {column.label}
                    </PortalButton>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
