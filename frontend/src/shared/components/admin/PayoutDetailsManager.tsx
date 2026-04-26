import { useState, useEffect } from 'react';
import { apiClient } from '../../api/apiClient';

interface UserPayout {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  payout_method: 'MPESA' | 'BANK' | null;
  payout_phone: string | null;
  payout_bank_name: string | null;
  payout_bank_account: string | null;
  payout_updated_at: string | null;
  payout_updated_by_name: string | null;
}

interface EditState {
  payoutMethod: 'MPESA' | 'BANK';
  payoutPhone: string;
  payoutBankName: string;
  payoutBankAccount: string;
}

const ROLE_BADGE: Record<string, string> = {
  CFO:              'bg-purple-100 text-purple-700',
  COO:              'bg-blue-100 text-blue-700',
  CTO:              'bg-indigo-100 text-indigo-700',
  EA:               'bg-teal-100 text-teal-700',
  HEAD_OF_TRAINERS: 'bg-orange-100 text-orange-700',
  TRAINER:          'bg-yellow-100 text-yellow-700',
  AGENT:            'bg-green-100 text-green-700',
  DEVELOPER:        'bg-pink-100 text-pink-700',
  OPERATIONS_USER:  'bg-cyan-100 text-cyan-700',
  TECH_STAFF:  'bg-violet-100 text-violet-700',
  CFO_ASSISTANT:    'bg-rose-100 text-rose-700',
};

export function PayoutDetailsManager() {
  const [users, setUsers] = useState<UserPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    payoutMethod: 'MPESA', payoutPhone: '', payoutBankName: '', payoutBankAccount: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [filter, setFilter] = useState<'all' | 'missing'>('all');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = filter === 'missing' ? '/api/v1/users/payout/missing' : '/api/v1/users/payout/all';
      const res = await apiClient.get<{ success: boolean; data: UserPayout[] }>(endpoint);
      setUsers(res.data.data);
    } catch {
      setError('Failed to load payout details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [filter]);

  const startEdit = (u: UserPayout) => {
    setEditingId(u.id);
    setSaveError('');
    setEditState({
      payoutMethod: u.payout_method || 'MPESA',
      payoutPhone: u.payout_phone || u.phone || '',
      payoutBankName: u.payout_bank_name || '',
      payoutBankAccount: u.payout_bank_account || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); setSaveError(''); };

  const saveEdit = async (userId: string) => {
    setSaveError('');
    if (editState.payoutMethod === 'MPESA' && !editState.payoutPhone.trim()) {
      setSaveError('M-Pesa phone number is required'); return;
    }
    if (editState.payoutMethod === 'BANK' && (!editState.payoutBankName.trim() || !editState.payoutBankAccount.trim())) {
      setSaveError('Bank name and account number are required'); return;
    }
    setSaving(true);
    try {
      await apiClient.patch(`/api/v1/users/${userId}/payout`, {
        payoutMethod: editState.payoutMethod,
        payoutPhone: editState.payoutMethod === 'MPESA' ? editState.payoutPhone.trim() : undefined,
        payoutBankName: editState.payoutMethod === 'BANK' ? editState.payoutBankName.trim() : undefined,
        payoutBankAccount: editState.payoutMethod === 'BANK' ? editState.payoutBankAccount.trim() : undefined,
      });
      setEditingId(null);
      await fetchUsers();
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || 'Failed to save payout details');
    } finally {
      setSaving(false);
    }
  };

  const missingCount = users.filter(u => !u.payout_method).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payout Details</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage bank / M-Pesa payout accounts for all payable staff
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-md font-medium ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            All staff
          </button>
          <button
            onClick={() => setFilter('missing')}
            className={`px-3 py-1.5 text-sm rounded-md font-medium flex items-center gap-1.5 ${filter === 'missing' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Missing
            {missingCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {missingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {filter === 'missing' ? 'All users have payout details set.' : 'No payable users found.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name / Email', 'Role', 'Method', 'Payout Account', 'Last Updated', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className={!u.payout_method ? 'bg-red-50' : ''}>
                  {/* Name / Email */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.full_name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>

                  {/* Method + Account — edit inline */}
                  {editingId === u.id ? (
                    <>
                      <td className="px-4 py-3" colSpan={2}>
                        <div className="flex flex-col gap-2">
                          {saveError && (
                            <p className="text-xs text-red-600">{saveError}</p>
                          )}
                          <div className="flex gap-4">
                            {(['MPESA', 'BANK'] as const).map(m => (
                              <label key={m} className="flex items-center gap-1.5 cursor-pointer text-xs">
                                <input
                                  type="radio"
                                  name={`method-${u.id}`}
                                  value={m}
                                  checked={editState.payoutMethod === m}
                                  onChange={() => setEditState(s => ({ ...s, payoutMethod: m }))}
                                />
                                {m === 'MPESA' ? 'M-Pesa' : 'Bank Transfer'}
                              </label>
                            ))}
                          </div>

                          {editState.payoutMethod === 'MPESA' ? (
                            <input
                              type="tel"
                              placeholder="M-Pesa phone e.g. 0712345678"
                              value={editState.payoutPhone}
                              onChange={e => setEditState(s => ({ ...s, payoutPhone: e.target.value }))}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Bank name"
                                value={editState.payoutBankName}
                                onChange={e => setEditState(s => ({ ...s, payoutBankName: e.target.value }))}
                                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                placeholder="Account number"
                                value={editState.payoutBankAccount}
                                onChange={e => setEditState(s => ({ ...s, payoutBankAccount: e.target.value }))}
                                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        {u.payout_method ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${u.payout_method === 'MPESA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {u.payout_method === 'MPESA' ? 'M-Pesa' : 'Bank'}
                          </span>
                        ) : (
                          <span className="text-xs text-red-500 font-medium">⚠ Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {u.payout_method === 'MPESA' && u.payout_phone && (
                          <span className="font-mono text-xs">{u.payout_phone}</span>
                        )}
                        {u.payout_method === 'BANK' && (
                          <div>
                            <div className="text-xs font-medium">{u.payout_bank_name}</div>
                            <div className="font-mono text-xs text-gray-500">{u.payout_bank_account}</div>
                          </div>
                        )}
                        {!u.payout_method && (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </td>
                    </>
                  )}

                  {/* Last Updated */}
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {u.payout_updated_at
                      ? new Date(u.payout_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                    {u.payout_updated_by_name && (
                      <div className="text-gray-300">by {u.payout_updated_by_name}</div>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(u.id)}
                          disabled={saving}
                          className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(u)}
                        className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-200"
                      >
                        {u.payout_method ? 'Edit' : 'Set payout'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PayoutDetailsManager;
