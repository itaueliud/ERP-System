/**
 * Client Success & Account Management Department Dashboard
 * Doc §4 Department 2, Doc §6 Portal 4
 * Receives converted clients, manages through delivery
 */
import React, { useState } from 'react';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useMultiPortalData } from '../../shared/utils/usePortalData';

const theme = PORTAL_THEMES.operations;
const cardCls = 'rounded-2xl p-5';
const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)' };
const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

const NAV = [
  { id: 'overview',   label: 'Overview',         icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
  { id: 'clients',    label: 'My Clients',        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { id: 'briefing',   label: 'Morning Briefing',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: 'liaison',    label: 'Liaison to CTO',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg> },
  { id: 'achievements', label: 'Achievements',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg> },
  { id: 'report',     label: 'Daily Report',      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
];

export default function ClientSuccessDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [liaisonForm, setLiaisonForm] = useState({ clientId: '', brief: '', priority: 'MEDIUM' });
  const [liaisonMsg, setLiaisonMsg] = useState('');
  const [reportForm, setReportForm] = useState({ accomplishments: '', challenges: '', plan: '', hours: '' });
  const [reportMsg, setReportMsg] = useState('');

  const { data, refetch } = useMultiPortalData([
    { key: 'metrics',       endpoint: '/api/v1/dashboard/metrics',          fallback: {} },
    { key: 'clients',       endpoint: '/api/v1/clients?status=CLOSED_WON',  fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.clients || []) },
    { key: 'achievements',  endpoint: '/api/v1/achievements',               fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'notifications', endpoint: '/api/v1/notifications',              fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r?.notifications || r?.data || []) },
  ] as any, [
    'data:client:status_changed', 'data:notification:new', 'data:metrics:updated',
  ]);

  const d = data as any;
  const metrics = d.metrics || {};
  const clients = d.clients || [];
  const achievements = d.achievements || [];
  const notifs = d.notifications || [];

  const followUpsToday = clients.filter((c: any) => {
    const next = c.nextFollowUp || c.followUpDate;
    if (!next) return false;
    return new Date(next).toDateString() === new Date().toDateString();
  }).length;

  const submitLiaison = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/liaison-requests', liaisonForm);
      setLiaisonMsg('Project brief sent to CTO team!');
      setLiaisonForm({ clientId: '', brief: '', priority: 'MEDIUM' });
    } catch (err: any) { setLiaisonMsg(err?.response?.data?.error || 'Failed to send brief'); }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', { accomplishments: reportForm.accomplishments, challenges: reportForm.challenges, tomorrowPlan: reportForm.plan, hoursWorked: parseFloat(reportForm.hours) || undefined, reportDate: new Date().toISOString().split('T')[0] });
      setReportMsg('Report submitted!');
      setReportForm({ accomplishments: '', challenges: '', plan: '', hours: '' });
    } catch (err: any) { setReportMsg(err?.response?.data?.error || 'Failed'); }
  };

  const portalUser = { name: user?.name || 'Account Executive', email: user?.email || '', role: 'Client Success' };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={NAV} activeSection={section} onSectionChange={setSection} onLogout={onLogout}>

      {section === 'overview' && (
        <div>
          <SectionHeader title="Client Success Overview" subtitle="Clients under your management" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Clients Under Management" value={clients.length || metrics.myClients || 0} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} color={theme.hex} />
            <StatCard label="Client Satisfaction" value={metrics.satisfactionScore ? `${metrics.satisfactionScore}%` : '—'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} color={theme.hex} />
            <StatCard label="Follow-ups Due Today" value={followUpsToday} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} color={theme.hex} />
            <StatCard label="Projects in Delivery" value={metrics.projectsInDelivery ?? clients.filter((c: any) => c.projectPhase === 'IN_DELIVERY').length} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'clients' && (
        <div>
          <SectionHeader title="Converted Clients" subtitle="Clients assigned to you — appears automatically after deposit payment confirmed" />
          <DataTable
            columns={[
              { key: 'name', label: 'Client Name' },
              { key: 'industryCategory', label: 'Category', render: v => v || '—' },
              { key: 'serviceDescription', label: 'Service', render: v => v ? String(v).slice(0, 40) + (String(v).length > 40 ? '…' : '') : '—' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'CLOSED_WON'} /> },
              { key: 'createdAt', label: 'Assigned', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'projectPhase', label: 'Project Phase', render: v => v || 'ONBOARDING' },
            ]}
            rows={clients}
            emptyMessage="No clients assigned yet — clients appear here after deposit payment is confirmed"
          />
        </div>
      )}

      {section === 'briefing' && (
        <div>
          <SectionHeader title="Morning Briefing" subtitle="9 AM — current clients, follow-up tasks, calls, challenges" />
          <div className={cardCls} style={cardStyle}>
            <p className="text-sm font-semibold text-gray-700 mb-4">Today's Briefing — {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Follow-ups Due Today</p>
                {clients.filter((c: any) => { const d = c.nextFollowUp || c.followUpDate; return d && new Date(d).toDateString() === new Date().toDateString(); }).length === 0
                  ? <p className="text-sm text-gray-400">No follow-ups scheduled for today</p>
                  : clients.filter((c: any) => { const d = c.nextFollowUp || c.followUpDate; return d && new Date(d).toDateString() === new Date().toDateString(); }).map((c: any, i: number) => (
                    <div key={c.id || i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                      <span className="text-sm font-medium text-gray-800">{c.name}</span>
                      <StatusBadge status={c.status || 'ACTIVE'} />
                    </div>
                  ))
                }
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Active Projects</p>
                <DataTable
                  columns={[{ key: 'name', label: 'Client' }, { key: 'projectPhase', label: 'Phase', render: v => v || 'ONBOARDING' }, { key: 'serviceDescription', label: 'Service', render: v => v ? String(v).slice(0, 50) : '—' }]}
                  rows={clients.slice(0, 5)}
                  emptyMessage="No active projects"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'liaison' && (
        <div>
          <SectionHeader title="Liaison to CTO Team" subtitle="Send project briefs to the CTO development team" />
          {liaisonMsg && <div className="p-3 rounded-xl text-sm mb-4 bg-green-50 text-green-700">{liaisonMsg}</div>}
          <form onSubmit={submitLiaison} className={`${cardCls} max-w-lg`} style={cardStyle}>
            <div className="mb-4">
              <label className={labelCls}>Client *</label>
              <select required value={liaisonForm.clientId} onChange={e => setLiaisonForm(f => ({ ...f, clientId: e.target.value }))} className={inputCls}>
                <option value="">Select client…</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className={labelCls}>Project Brief *</label>
              <textarea required rows={5} value={liaisonForm.brief} onChange={e => setLiaisonForm(f => ({ ...f, brief: e.target.value }))} className={`${inputCls} resize-none`} placeholder="Describe the project requirements, scope, and any client-specific notes…" />
            </div>
            <div className="mb-6">
              <label className={labelCls}>Priority</label>
              <select value={liaisonForm.priority} onChange={e => setLiaisonForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <PortalButton color={theme.hex} fullWidth>Send Brief to CTO Team</PortalButton>
          </form>
        </div>
      )}

      {section === 'achievements' && (
        <div>
          <SectionHeader title="Team Achievements" subtitle="Client Success achievements across countries" />
          <DataTable
            columns={[{ key: 'country', label: 'Country' }, { key: 'achievement', label: 'Achievement' }, { key: 'period', label: 'Period' }, { key: 'value', label: 'Value' }]}
            rows={achievements}
            emptyMessage="No achievements recorded"
          />
        </div>
      )}

      {section === 'report' && (
        <div>
          <SectionHeader title="Daily Report" subtitle="Submit before 10 PM" />
          {reportMsg && <div className="p-3 rounded-xl text-sm mb-4 bg-green-50 text-green-700">{reportMsg}</div>}
          <form onSubmit={submitReport} className={`${cardCls} max-w-2xl`} style={cardStyle}>
            <div className="mb-4"><label className={labelCls}>Accomplishments *</label><textarea required rows={3} value={reportForm.accomplishments} onChange={e => setReportForm(f => ({ ...f, accomplishments: e.target.value }))} className={`${inputCls} resize-none`} /></div>
            <div className="mb-4"><label className={labelCls}>Challenges</label><textarea rows={3} value={reportForm.challenges} onChange={e => setReportForm(f => ({ ...f, challenges: e.target.value }))} className={`${inputCls} resize-none`} /></div>
            <div className="mb-4"><label className={labelCls}>Plan for tomorrow</label><textarea rows={3} value={reportForm.plan} onChange={e => setReportForm(f => ({ ...f, plan: e.target.value }))} className={`${inputCls} resize-none`} /></div>
            <div className="mb-6"><label className={labelCls}>Hours worked</label><input type="number" min={0} max={24} value={reportForm.hours} onChange={e => setReportForm(f => ({ ...f, hours: e.target.value }))} className={inputCls} /></div>
            <div className="flex gap-2">
              <PortalButton color={theme.hex} fullWidth>Submit Report</PortalButton>
              <PortalButton variant="secondary" onClick={() => setReportForm({ accomplishments: '', challenges: '', plan: '', hours: '' })}>Clear</PortalButton>
            </div>
          </form>
        </div>
      )}

    </PortalLayout>
  );
}
