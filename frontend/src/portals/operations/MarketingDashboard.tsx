/**
 * Marketing & Business Operations Department Dashboard
 * Doc §4 Department 3, Doc §6 Portal 4
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
  { id: 'overview',    label: 'Overview',         icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
  { id: 'campaigns',   label: 'Campaigns',         icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
  { id: 'leads',       label: 'Lead Generation',   icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
  { id: 'tasks',       label: 'Operational Tasks', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> },
  { id: 'achievements', label: 'Achievements',     icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg> },
  { id: 'report',      label: 'Evening Report',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
];

export default function MarketingDashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [section, setSection] = useState('overview');
  const [reportForm, setReportForm] = useState({ campaignResults: '', operationalUpdates: '', recommendations: '', hours: '' });
  const [reportMsg, setReportMsg] = useState('');

  const { data } = useMultiPortalData([
    { key: 'metrics',       endpoint: '/api/v1/dashboard/metrics',          fallback: {} },
    { key: 'campaigns',     endpoint: '/api/v1/campaigns',                  fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'leads',         endpoint: '/api/v1/marketing/leads',            fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'tasks',         endpoint: '/api/v1/tasks',                      fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || r.tasks || []) },
    { key: 'achievements',  endpoint: '/api/v1/achievements',               fallback: [], transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
  ] as any, [
    'data:client:created', 'data:lead:converted', 'data:task:assigned', 'data:metrics:updated',
  ]);

  const d = data as any;
  const metrics = d.metrics || {};
  const campaigns = d.campaigns || [];
  const leads = d.leads || [];
  const tasks = d.tasks || [];
  const achievements = d.achievements || [];

  const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE').length;
  const conversionRate = leads.length > 0 ? Math.round((leads.filter((l: any) => l.converted).length / leads.length) * 100) : 0;

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', {
        accomplishments: reportForm.campaignResults,
        challenges: reportForm.operationalUpdates,
        tomorrowPlan: reportForm.recommendations,
        hoursWorked: parseFloat(reportForm.hours) || undefined,
        reportDate: new Date().toISOString().split('T')[0],
        reportType: 'EVENING_MARKETING',
      });
      setReportMsg('Evening report submitted!');
      setReportForm({ campaignResults: '', operationalUpdates: '', recommendations: '', hours: '' });
    } catch (err: any) { setReportMsg(err?.response?.data?.error || 'Failed'); }
  };

  const portalUser = { name: user?.name || 'Marketing Officer', email: user?.email || '', role: 'Marketing & Biz Ops' };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={NAV} activeSection={section} onSectionChange={setSection} onLogout={onLogout}>

      {section === 'overview' && (
        <div>
          <SectionHeader title="Marketing & Business Operations" subtitle="Campaign performance and operational metrics" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Active Campaigns" value={activeCampaigns} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>} color={theme.hex} />
            <StatCard label="Leads Generated This Month" value={metrics.leadsThisMonth ?? leads.length} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} color={theme.hex} />
            <StatCard label="Campaign Conversion Rate" value={`${conversionRate}%`} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} color={theme.hex} />
            <StatCard label="Operational Tasks Pending" value={tasks.filter((t: any) => t.status === 'NOT_STARTED' || t.status === 'IN_PROGRESS').length} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} color={theme.hex} />
          </div>
        </div>
      )}

      {section === 'campaigns' && (
        <div>
          <SectionHeader title="Campaign Tracker" subtitle="Active, paused, and completed campaigns" />
          <DataTable
            columns={[
              { key: 'name', label: 'Campaign' },
              { key: 'channel', label: 'Channel' },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'ACTIVE'} /> },
              { key: 'leadsGenerated', label: 'Leads', render: v => v ?? '—' },
              { key: 'conversionRate', label: 'Conversion', render: v => v ? `${v}%` : '—' },
              { key: 'startDate', label: 'Start', render: v => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={campaigns}
            emptyMessage="No campaigns found"
          />
        </div>
      )}

      {section === 'leads' && (
        <div>
          <SectionHeader title="Lead Generation Metrics" subtitle="By channel and by region" />
          <DataTable
            columns={[
              { key: 'channel', label: 'Channel' },
              { key: 'region', label: 'Region' },
              { key: 'count', label: 'Leads', render: v => v ?? '—' },
              { key: 'converted', label: 'Converted', render: v => v ?? '—' },
              { key: 'conversionRate', label: 'Rate', render: v => v ? `${v}%` : '—' },
            ]}
            rows={leads}
            emptyMessage="No lead generation data"
          />
        </div>
      )}

      {section === 'tasks' && (
        <div>
          <SectionHeader title="Operational Tasks" subtitle="Current operational task list" />
          <DataTable
            columns={[
              { key: 'title', label: 'Task' },
              { key: 'priority', label: 'Priority', render: v => <StatusBadge status={v || 'MEDIUM'} /> },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v || 'NOT_STARTED'} /> },
              { key: 'dueDate', label: 'Due', render: v => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={tasks}
            emptyMessage="No operational tasks"
          />
        </div>
      )}

      {section === 'achievements' && (
        <div>
          <SectionHeader title="Team Achievements" subtitle="Marketing achievements across countries" />
          <DataTable
            columns={[{ key: 'country', label: 'Country' }, { key: 'achievement', label: 'Achievement' }, { key: 'period', label: 'Period' }]}
            rows={achievements}
            emptyMessage="No achievements recorded"
          />
        </div>
      )}

      {section === 'report' && (
        <div>
          <SectionHeader title="Evening Report" subtitle="Submit before 10 PM — campaign results, operational updates, recommendations" />
          {reportMsg && <div className="p-3 rounded-xl text-sm mb-4 bg-green-50 text-green-700">{reportMsg}</div>}
          <form onSubmit={submitReport} className={`${cardCls} max-w-2xl`} style={cardStyle}>
            <div className="mb-4"><label className={labelCls}>Campaign Results *</label><textarea required rows={3} value={reportForm.campaignResults} onChange={e => setReportForm(f => ({ ...f, campaignResults: e.target.value }))} className={`${inputCls} resize-none`} /></div>
            <div className="mb-4"><label className={labelCls}>Operational Updates</label><textarea rows={3} value={reportForm.operationalUpdates} onChange={e => setReportForm(f => ({ ...f, operationalUpdates: e.target.value }))} className={`${inputCls} resize-none`} /></div>
            <div className="mb-4"><label className={labelCls}>Recommendations</label><textarea rows={3} value={reportForm.recommendations} onChange={e => setReportForm(f => ({ ...f, recommendations: e.target.value }))} className={`${inputCls} resize-none`} /></div>
            <div className="mb-6"><label className={labelCls}>Hours worked</label><input type="number" min={0} max={24} value={reportForm.hours} onChange={e => setReportForm(f => ({ ...f, hours: e.target.value }))} className={inputCls} /></div>
            <div className="flex gap-2">
              <PortalButton color={theme.hex} fullWidth>Submit Evening Report</PortalButton>
              <PortalButton variant="secondary" onClick={() => setReportForm({ campaignResults: '', operationalUpdates: '', recommendations: '', hours: '' })}>Clear</PortalButton>
            </div>
          </form>
        </div>
      )}

    </PortalLayout>
  );
}
