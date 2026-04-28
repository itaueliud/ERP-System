import { useState, useEffect } from 'react';
import { DataTable, StatusBadge, PortalButton, SectionHeader } from '../../../shared/components/layout/PortalLayout';

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

export default function TaskManagement({ themeHex }: { themeHex: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: ''
  });
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
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

  const handleSubmit = async () => {
    if (!form.title) {
      setMsgOk(false); setMsg('Title is required'); return;
    }
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.post('/api/v1/tasks', {
        ...form,
        dueDate: form.dueDate || undefined,
        assignedTo: form.assignedTo || undefined
      });
      setMsgOk(true); setMsg('Task created successfully!');
      setForm({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: '' });
      setShowForm(false);
      loadTasks();
    } catch (err: any) {
      setMsgOk(false); setMsg(err?.response?.data?.error || 'Failed to create task');
    }
  };

  const updateStatus = async (taskId: string, status: string) => {
    try {
      const { apiClient } = await import('../../../shared/api/apiClient');
      await apiClient.patch(`/api/v1/tasks/${taskId}/status`, { status });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    } catch { /* silent */ }
  };

  return (
    <div>
      <SectionHeader
        title="Task Management"
        subtitle="Create and track tasks"
        action={
          <PortalButton color={themeHex} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New Task'}
          </PortalButton>
        }
      />

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
          {msg && <div className={`p-3 rounded-xl text-sm mb-4 ${msgOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}
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
            <PortalButton color={themeHex} fullWidth onClick={handleSubmit}>Create Task</PortalButton>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading tasks...</p>
      ) : (
        <DataTable
          columns={[
            { key: 'title', label: 'Task' },
            { key: 'description', label: 'Description', render: v => v || '—' },
            { key: 'priority', label: 'Priority', render: v => <StatusBadge status={v || 'MEDIUM'} /> },
            { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'PENDING'} /> },
            { key: 'assignedToName', label: 'Assigned To', render: v => v || 'Unassigned' },
            { key: 'dueDate', label: 'Due Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
            { key: 'id', label: 'Actions', render: (id, row: any) => (
              row.status !== 'COMPLETED' ? (
                <PortalButton size="sm" color={themeHex} onClick={() => updateStatus(id, 'COMPLETED')}>
                  Complete
                </PortalButton>
              ) : <span className="text-xs text-green-600 font-semibold">✓ Done</span>
            )},
          ]}
          rows={tasks}
          emptyMessage="No tasks found"
        />
      )}
    </div>
  );
}
