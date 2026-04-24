import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { PortalLayout, StatCard, SectionHeader, DataTable, StatusBadge, PortalButton } from '../../shared/components/layout/PortalLayout';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';

const theme = PORTAL_THEMES.technology;

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.75)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.6)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

function DailyReportForm({ themeHex, onSubmitted }: { themeHex: string; onSubmitted?: () => void }) {
  const [accomplishments, setAccomplishments] = useState('');
  const [challenges, setChallenges] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg('');
    try {
      const { apiClient } = await import('../../shared/api/apiClient');
      await apiClient.post('/api/v1/reports', {
        accomplishments,
        challenges,
        tomorrowPlan,
        hoursWorked: parseFloat(hoursWorked) || undefined,
        reportDate: new Date().toISOString().split('T')[0],
      });
      setIsSuccess(true);
      setMsg('Report submitted successfully!');
      setAccomplishments('');
      setChallenges('');
      onSubmitted?.();
      setTomorrowPlan('');
      setHoursWorked('');
    } catch (err: any) {
      setIsSuccess(false);
      setMsg(err?.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      {msg && (
        <div className={`p-3 rounded-xl text-sm mb-4 ${isSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">What did you accomplish today? *</label>
          <textarea rows={3} required value={accomplishments} onChange={e => setAccomplishments(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Any challenges faced?</label>
          <textarea rows={3} value={challenges} onChange={e => setChallenges(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan for tomorrow</label>
          <textarea rows={3} value={tomorrowPlan} onChange={e => setTomorrowPlan(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all resize-none" />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours worked</label>
          <input type="number" min={0} max={24} value={hoursWorked} onChange={e => setHoursWorked(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
        </div>
        <PortalButton color={themeHex} fullWidth disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Report'}
        </PortalButton>
      </form>
    </div>
  );
}

const NAV = [
  { id: 'overview',     label: 'Overview',     icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg> },
  { id: 'projects',     label: 'Projects',     icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { id: 'teams',        label: 'Teams',        icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  { id: 'developers',   label: 'Developers',   icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
  { id: 'github',       label: 'GitHub',       icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> },
  { id: 'contracts',    label: 'Contracts',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { id: 'notifications',label: 'Notifications', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
  { id: 'daily-report', label: 'Daily Report', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
  { id: 'assign-project', label: 'Assign Project', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg> },
];

export default function TechnologyPortal() {
  const [section, setSection] = useState('overview');
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({ teamName: '', leaderId: '', member2Id: '', member3Id: '', githubOrg: '' });
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [teamMsg, setTeamMsg] = useState('');
  const [teamSuccess, setTeamSuccess] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data, loading, isLive, refetch } = useMultiPortalData([
    { key: 'summary',      endpoint: '/api/v1/dashboard/metrics',    fallback: {} },
    { key: 'projects',     endpoint: '/api/v1/projects',             fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || r.projects || []) },
    { key: 'repos',        endpoint: '/api/v1/github/repos',         fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'commits',      endpoint: '/api/v1/github/commits',       fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'contributors', endpoint: '/api/v1/github/contributions', fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'teams',        endpoint: '/api/v1/organization/teams',  fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'contracts',    endpoint: '/api/v1/contracts',           fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
    { key: 'userProfile',  endpoint: '/api/v1/users/me',            fallback: {}, transform: (r: any) => r?.data ?? r ?? {} },
    { key: 'notifications',endpoint: '/api/v1/notifications',       fallback: [],
      transform: (r: any) => Array.isArray(r) ? r : (r.data || []) },
  ] as any);

  const s       = (data as any).summary      || {};
  const projects = (data as any).projects    || [];
  const repos    = (data as any).repos       || [];
  const commits  = (data as any).commits     || [];
  const devs     = (data as any).contributors || [];
  const teams    = (data as any).teams       || [];
  const contracts = (data as any).contracts  || [];
  const notifs   = (data as any).notifications || [];
  const userProfile = (data as any).userProfile || {};
  // doc §17: Team Leader vs Non-Leader — isTeamLeader from user profile
  const isTeamLeader: boolean = userProfile.isTeamLeader === true || user?.isTeamLeader === true;

  const unreadCount = Array.isArray(notifs) ? notifs.filter((n: any) => !n.read).length : 0;
  const nav = NAV.map(n => {
    if (n.id === 'projects') return { ...n, badge: (s as any).activeProjects };
    if (n.id === 'notifications') return { ...n, badge: unreadCount || undefined };
    return n;
  });

  const handleLogout = () => { logout(); navigate('/login'); };
  const portalUser = { name: user?.name || 'Tech Lead', email: user?.email || 'tech@tst.com', role: 'Technology' };

  return (
    <PortalLayout theme={theme} user={portalUser} navItems={nav} activeSection={section} onSectionChange={setSection} onLogout={handleLogout}>

      {section === 'overview' && (
        <div>
          <SectionHeader title="Technology Overview" subtitle="Development metrics and project status" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Active Projects" value={(s as any).activeProjects ?? '—'}    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>} color={theme.hex} />
            <StatCard label="Developers"      value={(s as any).totalDevelopers ?? '—'}  icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>} color={theme.hex} />
            <StatCard label="Commits/Day"     value={(s as any).avgCommitsPerDay ?? '—'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} color={theme.hex} />
            <StatCard label="Open Issues"     value={(s as any).openIssues ?? '—'}       icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} color={theme.hex} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Recent Commits</h3>
              {(Array.isArray(commits) ? commits : []).slice(0, 5).map((c: any, i: number) => (
                <div key={c.sha || i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ backgroundColor: theme.hex }}>
                    {(c.author || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.message || 'Commit message'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-indigo-600">{(c.sha || 'abc1234').slice(0, 7)}</span>
                      <span className="text-xs text-gray-400">{c.author}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs flex-shrink-0">
                    <span className="text-green-600">+{c.additions || 0}</span>
                    <span className="text-gray-300 mx-1">/</span>
                    <span className="text-red-500">-{c.deletions || 0}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-5" style={cardStyle}>
              <h3 className="font-semibold text-gray-800 mb-4">Repositories</h3>
              {(Array.isArray(repos) ? repos : []).slice(0, 5).map((r: any, i: number) => (
                <div key={r.id || i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.name || `repo-${i}`}</p>
                    <p className="text-xs text-gray-400">{r.language || 'TypeScript'}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>⭐ {r.stars || 0}</span>
                    <span>🔀 {r.openPRs || 0} PRs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'projects' && (
        <div>
          <SectionHeader title="Project Tracking" subtitle="All active and completed development projects" />
          <DataTable
            columns={[
              { key: 'name',     label: 'Project' },
              { key: 'status',   label: 'Status',   render: (v) => <StatusBadge status={v || 'ACTIVE'} /> },
              { key: 'progress', label: 'Progress', render: (v) => (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${v || 0}%`, backgroundColor: theme.hex }} />
                  </div>
                  <span className="text-xs">{v || 0}%</span>
                </div>
              )},
              { key: 'teamSize', label: 'Team' },
              { key: 'dueDate',  label: 'Due', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={Array.isArray(projects) ? projects : []}
          />
        </div>
      )}

      {section === 'github' && (
        <div>
          <SectionHeader title="GitHub Integration" subtitle="Repository activity and pull requests" />
          <DataTable
            columns={[
              { key: 'name',       label: 'Repository' },
              { key: 'language',   label: 'Language' },
              { key: 'stars',      label: '⭐ Stars' },
              { key: 'openPRs',    label: 'Open PRs' },
              { key: 'openIssues', label: 'Issues' },
              { key: 'lastCommit', label: 'Last Commit', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
            ]}
            rows={Array.isArray(repos) ? repos : []}
          />
        </div>
      )}

      {section === 'daily-report' && (
        <div>
          <SectionHeader title="Daily Report" subtitle="Submit your end-of-day report" />
          <DailyReportForm themeHex={theme.hex} onSubmitted={() => refetch()} />
        </div>
      )}

      {section === 'teams' && (
        <div>
          <SectionHeader title="Developer Teams" subtitle="Teams of 3 developers with a designated leader"
            action={<PortalButton color={theme.hex} onClick={() => setShowTeamForm(f => !f)}>{showTeamForm ? 'Hide Form' : 'Create Team'}</PortalButton>} />
          {showTeamForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
              {teamMsg && (
                <div className={`p-3 rounded-xl text-sm mb-4 ${teamSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{teamMsg}</div>
              )}
              <form onSubmit={async (e) => {
                e.preventDefault();
                setTeamSubmitting(true);
                setTeamMsg('');
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  await apiClient.post('/api/v1/organization/teams', {
                    name: teamForm.teamName,
                    leaderId: teamForm.leaderId,
                    memberIds: [teamForm.leaderId, teamForm.member2Id, teamForm.member3Id],
                    githubOrg: teamForm.githubOrg || undefined,
                  });
                  setTeamSuccess(true);
                  setTeamMsg('Team created successfully!');
                  setTeamForm({ teamName: '', leaderId: '', member2Id: '', member3Id: '', githubOrg: '' });
                  setShowTeamForm(false);
                  refetch(['teams']);
                } catch (err: any) {
                  setTeamSuccess(false);
                  setTeamMsg(err?.response?.data?.error || 'Failed to create team');
                } finally {
                  setTeamSubmitting(false);
                }
              }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Name *</label>
                    <input type="text" required value={teamForm.teamName} onChange={e => setTeamForm(f => ({ ...f, teamName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Leader (User ID) *</label>
                    <input type="text" required value={teamForm.leaderId} onChange={e => setTeamForm(f => ({ ...f, leaderId: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Member 2 (User ID) *</label>
                    <input type="text" required value={teamForm.member2Id} onChange={e => setTeamForm(f => ({ ...f, member2Id: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Member 3 (User ID) *</label>
                    <input type="text" required value={teamForm.member3Id} onChange={e => setTeamForm(f => ({ ...f, member3Id: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">GitHub Organization</label>
                    <input type="text" value={teamForm.githubOrg} onChange={e => setTeamForm(f => ({ ...f, githubOrg: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                </div>
                <PortalButton color={theme.hex} fullWidth disabled={teamSubmitting}>
                  {teamSubmitting ? 'Creating…' : 'Create Team'}
                </PortalButton>
              </form>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Array.isArray(teams) ? teams : []).map((t: any, i: number) => (
              <div key={t.id || i} className="rounded-2xl p-5" style={cardStyle}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: theme.hex }}>{(t.name || 'T')[0]}</div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{t.name || `Team ${i + 1}`}</h4>
                    <p className="text-xs text-gray-400">{t.memberCount || 3} members</p>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-gray-600">
                  <p>Leader: <span className="font-medium text-gray-800">{t.leaderName || t.leaderId || '—'}</span></p>
                  {t.githubOrg && <p>GitHub: <span className="font-mono text-indigo-600">{t.githubOrg}</span></p>}
                </div>
              </div>
            ))}
            {!teams.length && <p className="text-sm text-gray-400 col-span-3 text-center py-8">No teams created yet</p>}
          </div>
        </div>
      )}

      {section === 'contracts' && (
        <div>
          <SectionHeader title="Contracts" subtitle="Download and sign developer contracts (team leaders only)" />
          <div className="p-4 mb-6 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            ℹ️ Only team leaders can download and sign contracts. Other team members have view-only access.
          </div>
          <DataTable
            columns={[
              { key: 'reference',    label: 'Reference' },
              { key: 'projectId',    label: 'Project' },
              { key: 'contractType', label: 'Type' },
              { key: 'status',       label: 'Status', render: (v) => <StatusBadge status={v || 'DRAFT'} /> },
              { key: 'createdAt',    label: 'Created', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
              { key: 'id', label: 'Actions', render: (_v, row: any) => (
                // Team leaders can download/sign; non-leaders view only (doc §17)
                isTeamLeader ? (
                  <div className="flex gap-2">
                    <PortalButton size="sm" color={theme.hex} onClick={async () => {
                      try {
                        const { apiClient } = await import('../../shared/api/apiClient');
                        const res = await apiClient.get(`/api/v1/contracts/${row.id}/download`);
                        if (res.data?.downloadUrl) window.open(res.data.downloadUrl, '_blank');
                      } catch { /* silent */ }
                    }}>Download</PortalButton>
                    <PortalButton size="sm" variant="secondary" onClick={async () => {
                      const email = prompt('Enter signer email:');
                      const name = prompt('Enter signer name:');
                      if (!email || !name) return;
                      try {
                        const { apiClient } = await import('../../shared/api/apiClient');
                        await apiClient.post(`/api/v1/contracts/${row.id}/signature-requests`, { signerEmail: email, signerName: name });
                        alert('Signature request sent!');
                      } catch (err: any) { alert(err?.response?.data?.error || 'Failed to send signature request'); }
                    }}>Sign</PortalButton>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">View only</span>
                )
              )},
            ]}
            rows={Array.isArray(contracts) ? contracts : []}
            emptyMessage="No contracts assigned to your team"
          />
        </div>
      )}

      {section === 'notifications' && (
        <div>
          <SectionHeader title="Notifications" subtitle="System alerts and updates" />
          <div className="space-y-3">
            {(Array.isArray(notifs) ? notifs : []).map((n: any, i: number) => (
              <div key={n.id || i} className={`bg-white rounded-2xl border p-4 flex items-start gap-4 ${n.read ? 'border-gray-100' : 'border-blue-100 bg-blue-50/30'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.hex + '22' }}>
                  <svg className="w-5 h-5" style={{ color: theme.hex }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{n.title || 'Notification'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.message || n.description || ''}</p>
                  {n.createdAt && <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>}
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />}
              </div>
            ))}
            {!notifs.length && <div className="text-center py-12 text-gray-400 text-sm">No notifications yet</div>}
          </div>
        </div>
      )}

      {section === 'developers' && (
        <div>
          <SectionHeader title="Developer Metrics" subtitle="Individual contribution statistics"
            action={<PortalButton color={theme.hex} onClick={() => setShowTeamForm(f => !f)}>Create Team</PortalButton>} />
          {showTeamForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 max-w-2xl">
              {teamMsg && (
                <div className={`p-3 rounded-xl text-sm mb-4 ${teamSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {teamMsg}
                </div>
              )}
              <form onSubmit={async (e) => {
                e.preventDefault();
                setTeamSubmitting(true);
                setTeamMsg('');
                try {
                  const { apiClient } = await import('../../shared/api/apiClient');
                  await apiClient.post('/api/v1/organization/teams', {
                    name: teamForm.teamName,
                    leaderId: teamForm.leaderId,
                    memberIds: [teamForm.leaderId, teamForm.member2Id, teamForm.member3Id],
                    githubOrg: teamForm.githubOrg || undefined,
                  });
                  setTeamSuccess(true);
                  setTeamMsg('Team created successfully!');
                  setTeamForm({ teamName: '', leaderId: '', member2Id: '', member3Id: '', githubOrg: '' });
                  setShowTeamForm(false);
                  refetch(['teams']);
                } catch (err: any) {
                  setTeamSuccess(false);
                  setTeamMsg(err?.response?.data?.error || 'Failed to create team');
                } finally {
                  setTeamSubmitting(false);
                }
              }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Name *</label>
                    <input type="text" required value={teamForm.teamName} onChange={e => setTeamForm(f => ({ ...f, teamName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Leader (User ID) *</label>
                    <input type="text" required value={teamForm.leaderId} onChange={e => setTeamForm(f => ({ ...f, leaderId: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Member 2 (User ID) *</label>
                    <input type="text" required value={teamForm.member2Id} onChange={e => setTeamForm(f => ({ ...f, member2Id: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Member 3 (User ID) *</label>
                    <input type="text" required value={teamForm.member3Id} onChange={e => setTeamForm(f => ({ ...f, member3Id: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">GitHub Organization</label>
                    <input type="text" value={teamForm.githubOrg} onChange={e => setTeamForm(f => ({ ...f, githubOrg: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
                  </div>
                </div>
                <PortalButton color={theme.hex} fullWidth disabled={teamSubmitting}>
                  {teamSubmitting ? 'Creating…' : 'Create Team'}
                </PortalButton>
              </form>
            </div>
          )}
          <DataTable
            columns={[
              { key: 'name',         label: 'Developer' },
              { key: 'commits',      label: 'Commits' },
              { key: 'additions',    label: 'Lines Added',   render: (v) => <span className="text-green-600">+{(v || 0).toLocaleString()}</span> },
              { key: 'deletions',    label: 'Lines Removed', render: (v) => <span className="text-red-500">-{(v || 0).toLocaleString()}</span> },
              { key: 'pullRequests', label: 'PRs Merged' },
            ]}
            rows={Array.isArray(devs) ? devs : []}
          />
          <p className="mt-4 text-sm text-gray-500 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            Each developer must have a GitHub account linked in their profile. Team leader can chat and download contracts; other members can view only.
          </p>
        </div>
      )}

      {/* Assign Project to Dev Team — CTO only per permissions matrix */}
      {section === 'assign-project' && user?.role === 'CTO' && (
        <div>
          <SectionHeader title="Assign Project to Dev Team" subtitle="CTO assigns projects to development teams" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg">
            {assignMsg && (
              <div className={`p-3 rounded-xl text-sm mb-4 ${assignSuccess ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {assignMsg}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project ID *</label>
                <input type="text" value={assignProjectId} onChange={e => setAssignProjectId(e.target.value)}
                  placeholder="Project UUID"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Team ID *</label>
                <input type="text" value={assignTeamId} onChange={e => setAssignTeamId(e.target.value)}
                  placeholder="Team UUID"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition-all" />
              </div>
              <PortalButton
                color={theme.hex}
                fullWidth
                disabled={assignSubmitting || !assignProjectId || !assignTeamId}
                onClick={async () => {
                  setAssignSubmitting(true); setAssignMsg(''); setAssignSuccess(false);
                  try {
                    const { apiClient } = await import('../../shared/api/apiClient');
                    await apiClient.post(`/api/v1/projects/${assignProjectId}/assign-team`, { teamId: assignTeamId });
                    setAssignMsg('Project assigned to team successfully!');
                    setAssignSuccess(true);
                    setAssignProjectId(''); setAssignTeamId('');
                  } catch (err: any) {
                    setAssignMsg(err?.response?.data?.error || 'Failed to assign project');
                    setAssignSuccess(false);
                  } finally { setAssignSubmitting(false); }
                }}
              >
                {assignSubmitting ? 'Assigning…' : 'Assign Project'}
              </PortalButton>
            </div>
          </div>
        </div>
      )}

      {section === 'assign-project' && user?.role !== 'CTO' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-sm text-amber-800">
          Only the CTO can assign projects to development teams.
        </div>
      )}

    </PortalLayout>
  );
}
