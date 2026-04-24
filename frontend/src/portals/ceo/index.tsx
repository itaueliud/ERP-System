import React, { useState } from 'react';
import { useNavigate } from '../../shared/utils/router';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useMultiPortalData } from '../../shared/utils/usePortalData';
import { apiClient } from '../../shared/api/apiClient';
import { TSTEmblem } from '../../shared/components/TSTLogo';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy:    '#0f172a',
  navy2:   '#1e293b',
  blue:    '#1d4ed8',
  blue2:   '#2563eb',
  blueL:   '#eff6ff',
  green:   '#16a34a',
  greenL:  '#f0fdf4',
  amber:   '#d97706',
  amberL:  '#fffbeb',
  red:     '#dc2626',
  redL:    '#fef2f2',
  purple:  '#7c3aed',
  purpleL: '#f5f3ff',
  border:  '#e2e8f0',
  bg:      '#f8fafc',
  text:    '#0f172a',
  muted:   '#64748b',
  white:   '#ffffff',
};

// ─── Shared primitives ────────────────────────────────────────────────────────
const card = 'bg-white rounded-2xl border border-slate-100 shadow-sm';
const inp  = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all';
const lbl  = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  overview:  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  finance:   <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  sales:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  ops:       <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  people:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  contracts: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  approvals: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  reports:   <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  notif:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  admin:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  logout:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  trend_up:  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>,
  trend_dn:  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>,
  check:     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>,
  x:         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>,
  plus:      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>,
  eye:       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  dollar:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  users2:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  globe:     <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  shield:    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
};

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { id: 'overview',   label: 'Overview',       icon: Ic.overview },
      { id: 'finance',    label: 'Finance',         icon: Ic.finance },
      { id: 'sales',      label: 'Sales & Leads',   icon: Ic.sales },
      { id: 'operations', label: 'Operations',      icon: Ic.ops },
    ],
  },
  {
    label: 'Management',
    items: [
      { id: 'people',     label: 'People',          icon: Ic.people },
      { id: 'contracts',  label: 'Contracts',       icon: Ic.contracts },
      { id: 'approvals',  label: 'Approvals',       icon: Ic.approvals },
      { id: 'reports',    label: 'Reports',         icon: Ic.reports },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Ic.notif },
      { id: 'admin',         label: 'System Admin',  icon: Ic.admin },
    ],
  },
];

const ALL_ROLES = ['CEO','CoS','CFO','COO','CTO','EA','HEAD_OF_TRAINERS','TRAINER','AGENT','OPERATIONS_USER','TECHNOLOGY_USER','DEVELOPER','CFO_ASSISTANT'];
const CEO_INVITABLE_ROLES = ['CoS','CFO','COO','CTO','EA'];

// ─── Small reusable components ────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    ACTIVE:           { bg: C.greenL,  text: C.green,  dot: C.green },
    COMPLETED:        { bg: C.greenL,  text: C.green,  dot: C.green },
    APPROVED:         { bg: C.greenL,  text: C.green,  dot: C.green },
    EXECUTED:         { bg: C.greenL,  text: C.green,  dot: C.green },
    CLOSED_WON:       { bg: C.greenL,  text: C.green,  dot: C.green },
    PENDING:          { bg: C.amberL,  text: C.amber,  dot: C.amber },
    PENDING_APPROVAL: { bg: C.amberL,  text: C.amber,  dot: C.amber },
    IN_PROGRESS:      { bg: C.blueL,   text: C.blue2,  dot: C.blue2 },
    DRAFT:            { bg: '#f1f5f9', text: C.muted,  dot: C.muted },
    REJECTED:         { bg: C.redL,    text: C.red,    dot: C.red },
    SUSPENDED:        { bg: C.redL,    text: C.red,    dot: C.red },
    FAILED:           { bg: C.redL,    text: C.red,    dot: C.red },
    NEW_LEAD:         { bg: C.purpleL, text: C.purple, dot: C.purple },
    LEAD_QUALIFIED:   { bg: C.blueL,   text: C.blue2,  dot: C.blue2 },
    LEAD_ACTIVATED:   { bg: C.blueL,   text: C.blue2,  dot: C.blue2 },
  };
  const style = map[s] || { bg: '#f1f5f9', text: C.muted, dot: C.muted };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: style.bg, color: style.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
      {s.replace(/_/g, ' ')}
    </span>
  );
}

function KpiCard({ label, value, sub, color, icon, trend }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ReactNode; trend?: { up: boolean; val: string };
}) {
  return (
    <div className={`${card} p-5 flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
          style={{ background: color }}>
          {icon}
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
            style={{ background: trend.up ? C.greenL : C.redL, color: trend.up ? C.green : C.red }}>
            {trend.up ? Ic.trend_up : Ic.trend_dn} {trend.val}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-sm font-medium text-slate-500 mt-1">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, icon }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md'; disabled?: boolean; icon?: React.ReactNode;
}) {
  const base = 'inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const sz   = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';
  const v: Record<string, string> = {
    primary:   `text-white hover:opacity-90 active:scale-[0.97]`,
    secondary: `bg-slate-100 text-slate-700 hover:bg-slate-200`,
    danger:    `bg-red-50 text-red-600 hover:bg-red-100`,
    ghost:     `text-slate-600 hover:bg-slate-100`,
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${sz} ${v[variant]}`}
      style={variant === 'primary' ? { background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blue2} 100%)` } : {}}>
      {icon}{children}
    </button>
  );
}

function Table({ cols, rows, empty = 'No data' }: {
  cols: { key: string; label: string; render?: (v: any, r: any) => React.ReactNode }[];
  rows: any[]; empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100" style={{ background: '#f8fafc' }}>
            {cols.map(c => (
              <th key={c.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-4 py-8 text-center text-slate-400 text-sm">{empty}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={row.id || i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
              {cols.map(c => (
                <td key={c.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ section, setSection, unread, pendingCount, user, onLogout }: {
  section: string; setSection: (s: string) => void;
  unread: number; pendingCount: number; user: any; onLogout: () => void;
}) {
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto"
      style={{ background: C.navy, borderRight: `1px solid rgba(255,255,255,0.06)` }}>

      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <TSTEmblem size={32} />
        <div>
          <p className="text-white font-bold text-sm leading-tight">TechSwiftTrix</p>
          <p className="text-slate-400 text-xs">CEO Portal</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = section === item.id;
                const badge = item.id === 'notifications' ? unread
                            : item.id === 'approvals'     ? pendingCount
                            : 0;
                return (
                  <button key={item.id} onClick={() => setSection(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={active
                      ? { background: C.blue2, color: '#fff' }
                      : { color: '#94a3b8' }
                    }
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; } }}>
                    <span className="flex-shrink-0 opacity-90">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                        style={{ background: item.id === 'admin' ? C.blue2 : '#ef4444', color: '#fff' }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: C.blue2 }}>
            {(user?.name || 'C').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.name || 'CEO'}</p>
            <p className="text-slate-500 text-[10px] truncate">{user?.email || ''}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
          {Ic.logout} Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ section, unread, setSection }: { section: string; unread: number; setSection: (s: string) => void }) {
  const titles: Record<string, string> = {
    overview: 'Overview', finance: 'Finance', sales: 'Sales & Leads',
    operations: 'Operations', people: 'People', contracts: 'Contracts',
    approvals: 'Approvals Queue', reports: 'Reports',
    notifications: 'Notifications', admin: 'System Admin',
  };
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-100 flex-shrink-0">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-bold text-slate-900">{titles[section] || section}</h1>
        {section === 'admin' && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: C.blue2 }}>
            CEO EXCLUSIVE
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <button onClick={() => setSection('notifications')}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all">
          {Ic.notif}
          {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />}
        </button>
      </div>
    </header>
  );
}

// ─── Section: Overview ────────────────────────────────────────────────────────
function OverviewSection({ data }: { data: any }) {
  const m = data.metrics || {};
  const clients = data.clients || [];
  const projects = data.projects || [];
  const pending = (Array.isArray(data.paymentApprovals) ? data.paymentApprovals : []).filter((p: any) => p.status === 'PENDING_APPROVAL');
  const auditLog = (data.auditLog || []).slice(0, 6);

  const kpis = [
    { label: 'Total Revenue',    value: m.totalRevenue    ? `KSh ${(m.totalRevenue/1e6).toFixed(1)}M`  : '—', color: C.blue2,   icon: Ic.dollar,  trend: m.revenueChange    ? { up: m.revenueChange > 0,    val: `${Math.abs(m.revenueChange)}%`    } : undefined },
    { label: 'Active Clients',   value: m.activeClients   ?? clients.length,                             color: C.green,   icon: Ic.people,  trend: m.clientsChange    ? { up: m.clientsChange > 0,    val: `${Math.abs(m.clientsChange)}%`    } : undefined },
    { label: 'Closed Deals',     value: m.closedDeals     ?? '—',                                        color: C.purple,  icon: Ic.sales,   trend: m.dealsChange      ? { up: m.dealsChange > 0,      val: `${Math.abs(m.dealsChange)}%`      } : undefined },
    { label: 'Active Projects',  value: projects.filter((p: any) => p.status === 'ACTIVE').length || m.activeProjects || '—', color: C.amber, icon: Ic.ops, trend: undefined },
    { label: 'Pending Approvals',value: pending.length,                                                   color: '#e11d48', icon: Ic.approvals, trend: undefined },
    { label: 'Total Leads',      value: m.totalLeads      ?? '—',                                        color: '#0891b2', icon: Ic.globe,   trend: m.leadsChange      ? { up: m.leadsChange > 0,      val: `${Math.abs(m.leadsChange)}%`      } : undefined },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} sub={undefined} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Revenue by platform */}
        <div className={`${card} p-5 xl:col-span-2`}>
          <SectionTitle title="Revenue by Platform" sub="All-time totals" />
          <div className="space-y-3">
            {[
              { name: 'TST PlotConnect',    key: 'plotconnectRevenue',  color: C.blue2  },
              { name: 'CashFlow Connect',   key: 'cashflowRevenue',     color: C.green  },
              { name: 'TST Billing System', key: 'billingRevenue',      color: C.purple },
            ].map(p => {
              const val = m[p.key] || 0;
              const total = (m.plotconnectRevenue || 0) + (m.cashflowRevenue || 0) + (m.billingRevenue || 0) || 1;
              const pct = Math.round((val / total) * 100);
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">{p.name}</span>
                    <span className="text-sm font-bold text-slate-900">KSh {(val / 1e6).toFixed(2)}M</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent audit */}
        <div className={`${card} p-5`}>
          <SectionTitle title="Recent Activity" sub="Last 6 actions" />
          <div className="space-y-2.5">
            {auditLog.length === 0 && <p className="text-sm text-slate-400">No activity yet</p>}
            {auditLog.map((a: any, i: number) => (
              <div key={a.id || i} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: a.result === 'SUCCESS' ? C.greenL : C.redL }}>
                  <span style={{ color: a.result === 'SUCCESS' ? C.green : C.red, fontSize: 10 }}>
                    {a.result === 'SUCCESS' ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{a.action || 'Action'}</p>
                  <p className="text-[10px] text-slate-400">{a.createdAt ? new Date(a.createdAt).toLocaleTimeString() : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent clients */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="Recent Clients" sub="Latest leads and conversions" />
        </div>
        <Table
          cols={[
            { key: 'name',             label: 'Client' },
            { key: 'industryCategory', label: 'Industry', render: v => v || '—' },
            { key: 'country',          label: 'Country' },
            { key: 'status',           label: 'Status',  render: v => <Badge status={v || 'NEW_LEAD'} /> },
            { key: 'createdAt',        label: 'Added',   render: v => v ? new Date(v).toLocaleDateString() : '—' },
          ]}
          rows={clients.slice(0, 8)}
          empty="No clients yet"
        />
      </div>
    </div>
  );
}

// ─── Section: Finance ─────────────────────────────────────────────────────────
function FinanceSection({ data }: { data: any }) {
  const m = data.metrics || {};
  const payments = Array.isArray(data.paymentApprovals) ? data.paymentApprovals : [];
  const amounts  = data.serviceAmounts   || [];
  const [tab, setTab] = useState<'payments' | 'amounts'>('payments');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',    value: m.totalRevenue    ? `KSh ${(m.totalRevenue/1e6).toFixed(1)}M`    : '—', color: C.blue2  },
          { label: 'Daily Cash Flow',  value: m.dailyCashFlow   ? `KSh ${(m.dailyCashFlow/1e3).toFixed(0)}K`   : '—', color: C.green  },
          { label: 'Pending Payments', value: payments.filter((p: any) => p.status === 'PENDING_APPROVAL').length, color: C.amber },
          { label: 'Tax Status',       value: m.taxFilingStatus || 'Up to date',                                      color: C.purple },
        ].map(k => <KpiCard key={k.label} {...k} icon={Ic.dollar} />)}
      </div>

      {/* Tab switcher */}
      <div className={card}>
        <div className="flex border-b border-slate-100">
          {(['payments', 'amounts'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px"
              style={tab === t
                ? { borderColor: C.blue2, color: C.blue2 }
                : { borderColor: 'transparent', color: C.muted }}>
              {t === 'payments' ? 'Payment Approvals' : 'Service Amounts'}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'payments' && (
            <Table
              cols={[
                { key: 'purpose',   label: 'Purpose' },
                { key: 'amount',    label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
                { key: 'status',    label: 'Status',       render: v => <Badge status={v || 'PENDING'} /> },
                { key: 'createdAt', label: 'Requested',    render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={payments}
              empty="No payment requests"
            />
          )}
          {tab === 'amounts' && (
            <Table
              cols={[
                { key: 'serviceName',    label: 'Service',      render: (v, r) => v || r.name || '—' },
                { key: 'category',       label: 'Category' },
                { key: 'currentAmount',  label: 'Amount (KSh)', render: (v, r) => ((v || r.amount || 0)).toLocaleString() },
                { key: 'status',         label: 'Status',       render: v => <Badge status={v || 'ACTIVE'} /> },
              ]}
              rows={amounts}
              empty="No service amounts configured"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Sales ───────────────────────────────────────────────────────────
function SalesSection({ data }: { data: any }) {
  const clients     = data.clients  || [];

  const byStatus = (s: string) => clients.filter((c: any) => c.status === s).length;

  return (
    <div className="space-y-5">
      {/* Pipeline funnel */}
      <div className={`${card} p-5`}>
        <SectionTitle title="Lead Pipeline" sub="Current status distribution" />
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'New Lead',       status: 'NEW_LEAD',       color: C.purple },
            { label: 'Converted',      status: 'CONVERTED',      color: C.blue2  },
            { label: 'Activated',      status: 'LEAD_ACTIVATED', color: '#0891b2' },
            { label: 'Qualified',      status: 'LEAD_QUALIFIED', color: C.amber  },
            { label: 'Negotiation',    status: 'NEGOTIATION',    color: '#ea580c' },
            { label: 'Closed Won',     status: 'CLOSED_WON',     color: C.green  },
          ].map(s => (
            <div key={s.status} className="rounded-xl p-3 text-center border border-slate-100"
              style={{ background: s.color + '10' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{byStatus(s.status)}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Clients table */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="All Clients" sub={`${clients.length} total`} />
        </div>
        <Table
          cols={[
            { key: 'name',             label: 'Client' },
            { key: 'phone',            label: 'Phone' },
            { key: 'country',          label: 'Country' },
            { key: 'industryCategory', label: 'Industry', render: v => v || '—' },
            { key: 'status',           label: 'Status',   render: v => <Badge status={v || 'NEW_LEAD'} /> },
            { key: 'createdAt',        label: 'Added',    render: v => v ? new Date(v).toLocaleDateString() : '—' },
          ]}
          rows={clients}
          empty="No clients yet"
        />
      </div>
    </div>
  );
}

// ─── Section: Operations ──────────────────────────────────────────────────────
function OperationsSection({ data }: { data: any }) {
  const projects   = data.projects   || [];
  const properties = data.properties || [];
  const repos      = data.repos      || [];
  const [tab, setTab] = useState<'projects' | 'properties' | 'github'>('projects');

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects',    value: projects.length,                                                    color: C.blue2  },
          { label: 'Active Projects',   value: projects.filter((p: any) => p.status === 'ACTIVE').length,          color: C.green  },
          { label: 'Properties Listed', value: properties.filter((p: any) => p.status === 'PUBLISHED').length,     color: C.purple },
          { label: 'GitHub Repos',      value: repos.length,                                                       color: C.navy2  },
        ].map(k => <KpiCard key={k.label} {...k} icon={Ic.ops} />)}
      </div>

      <div className={card}>
        <div className="flex border-b border-slate-100">
          {(['projects', 'properties', 'github'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px capitalize"
              style={tab === t ? { borderColor: C.blue2, color: C.blue2 } : { borderColor: 'transparent', color: C.muted }}>
              {t === 'github' ? 'GitHub' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'projects' && (
            <Table
              cols={[
                { key: 'referenceNumber', label: 'Ref #' },
                { key: 'clientId',        label: 'Client',   render: (v, r) => r.clientName || v || '—' },
                { key: 'serviceAmount',   label: 'Amount',   render: v => v ? `KSh ${Number(v).toLocaleString()}` : '—' },
                { key: 'status',          label: 'Status',   render: v => <Badge status={v || 'PENDING'} /> },
                { key: 'startDate',       label: 'Start',    render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={projects}
              empty="No projects yet"
            />
          )}
          {tab === 'properties' && (
            <Table
              cols={[
                { key: 'propertyName',  label: 'Property' },
                { key: 'location',      label: 'Location' },
                { key: 'propertyType',  label: 'Type',    render: v => (v || '').replace(/_/g, ' ') },
                { key: 'placementTier', label: 'Tier',    render: v => v || '—' },
                { key: 'status',        label: 'Status',  render: v => <Badge status={v || 'PENDING'} /> },
              ]}
              rows={properties}
              empty="No properties listed"
            />
          )}
          {tab === 'github' && (
            <Table
              cols={[
                { key: 'name',      label: 'Repository' },
                { key: 'fullName',  label: 'Full Name' },
                { key: 'url',       label: 'URL', render: v => v ? <a href={v} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">{v.replace('https://github.com/', '')}</a> : '—' },
                { key: 'lastSynced', label: 'Last Sync', render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={repos}
              empty="No repositories linked"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: People ──────────────────────────────────────────────────────────
function PeopleSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const users = data.users || [];
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('CoS');
  const [msg,  setMsg]  = useState('');
  const [ok,   setOk]   = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setBusy(true); setMsg('');
    try {
      const rolesRes = await apiClient.get('/api/v1/users/roles');
      const roles: any[] = rolesRes.data?.data || [];
      const roleObj = roles.find((r: any) => r.name === inviteRole);
      if (!roleObj) { setMsg(`Role "${inviteRole}" not found.`); setOk(false); setBusy(false); return; }
      await apiClient.post('/api/v1/users/invite', { email: inviteEmail, roleId: roleObj.id });
      setMsg(`Invitation sent to ${inviteEmail}`); setOk(true); setInviteEmail(''); refetch(['users']);
    } catch (e: any) { setMsg(e?.response?.data?.error || 'Failed to send invitation.'); setOk(false); }
    finally { setBusy(false); }
  };

  const filtered = users.filter((u: any) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (u.fullName || u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Invite card */}
      <div className={`${card} p-5`}>
        <SectionTitle title="Invite New User" sub="CEO can invite C-level accounts only" />
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className={lbl}>Email address</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="user@tst.com" className={inp} />
          </div>
          <div className="w-40">
            <label className={lbl}>Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={inp}>
              {CEO_INVITABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Btn onClick={handleInvite} disabled={busy || !inviteEmail} icon={Ic.plus}>
            {busy ? 'Sending…' : 'Send Invite'}
          </Btn>
        </div>
        {msg && (
          <div className={`mt-3 flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {ok ? Ic.check : Ic.x} {msg}
          </div>
        )}
      </div>

      {/* Users table */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">All Users</h2>
            <p className="text-sm text-slate-500">{users.length} accounts in system</p>
          </div>
          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search name, email, role…"
            className="w-56 px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
        </div>
        <Table
          cols={[
            { key: 'fullName',  label: 'Name',   render: (v, r) => v || r.name || '—' },
            { key: 'email',     label: 'Email' },
            { key: 'role',      label: 'Role',   render: (v, r) => v || r.roleName || '—' },
            { key: 'country',   label: 'Country' },
            { key: 'isActive',  label: 'Status', render: v => <Badge status={v === false ? 'SUSPENDED' : 'ACTIVE'} /> },
            { key: 'createdAt', label: 'Joined', render: v => v ? new Date(v).toLocaleDateString() : '—' },
          ]}
          rows={filtered}
          empty="No users found"
        />
      </div>
    </div>
  );
}

// ─── Section: Contracts ───────────────────────────────────────────────────────
function ContractsSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const contracts = data.contracts || [];
  const projects  = data.projects  || [];
  const [form, setForm] = useState({ projectId: '', clientName: '', serviceDescription: '', serviceAmount: '', currency: 'KES', notes: '' });
  const [msg,  setMsg]  = useState('');
  const [ok,   setOk]   = useState(false);
  const [busy, setBusy] = useState(false);
  const [dlBusy, setDlBusy] = useState<string | null>(null);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      const payload: any = form.projectId ? { projectId: form.projectId } : { ...form, serviceAmount: parseFloat(form.serviceAmount) || 0 };
      const res = await apiClient.post('/api/v1/contracts/generate-direct', payload);
      setMsg(`Contract ${res.data?.referenceNumber || ''} generated!`); setOk(true);
      setForm({ projectId: '', clientName: '', serviceDescription: '', serviceAmount: '', currency: 'KES', notes: '' });
      refetch(['contracts']);
    } catch (e: any) { setMsg(e?.response?.data?.error || 'Failed to generate contract.'); setOk(false); }
    finally { setBusy(false); }
  };

  const download = async (id: string) => {
    setDlBusy(id);
    try {
      const res = await apiClient.get(`/api/v1/contracts/${id}/download`);
      if (res.data?.downloadUrl) window.open(res.data.downloadUrl, '_blank');
    } catch { /* silent */ }
    finally { setDlBusy(null); }
  };

  return (
    <div className="space-y-5">
      {/* Generator */}
      <div className={`${card} p-5`}>
        <SectionTitle title="Generate Contract" sub="PDF auto-includes transaction ID, payment date and client info" />
        <form onSubmit={generate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Link to Project (optional)</label>
              <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} className={inp}>
                <option value="">— Manual entry —</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.referenceNumber || p.id}</option>)}
              </select>
            </div>
            {!form.projectId && <>
              <div>
                <label className={lbl}>Client Name</label>
                <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} className={inp} placeholder="Client full name" />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Service Description</label>
                <input value={form.serviceDescription} onChange={e => setForm(f => ({ ...f, serviceDescription: e.target.value }))} className={inp} placeholder="e.g. School Portal / LMS" />
              </div>
              <div>
                <label className={lbl}>Amount</label>
                <input type="number" value={form.serviceAmount} onChange={e => setForm(f => ({ ...f, serviceAmount: e.target.value }))} className={inp} placeholder="0.00" />
              </div>
              <div>
                <label className={lbl}>Currency</label>
                <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={inp}>
                  {['KES','UGX','TZS','USD','EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>}
          </div>
          <Btn disabled={busy} icon={Ic.contracts}>{busy ? 'Generating…' : 'Generate Contract PDF'}</Btn>
          {msg && <div className={`flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-xl ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{ok ? Ic.check : Ic.x} {msg}</div>}
        </form>
      </div>

      {/* Contracts list */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="All Contracts" sub={`${contracts.length} contracts`} />
        </div>
        <Table
          cols={[
            { key: 'referenceNumber', label: 'Ref #' },
            { key: 'projectId',       label: 'Project',  render: (v, r) => r.projectRef || v || '—' },
            { key: 'status',          label: 'Status',   render: v => <Badge status={v || 'DRAFT'} /> },
            { key: 'version',         label: 'Version',  render: v => `v${v || 1}` },
            { key: 'createdAt',       label: 'Created',  render: v => v ? new Date(v).toLocaleDateString() : '—' },
            { key: 'id',              label: '',         render: (_v, r) => (
              <Btn size="sm" variant="secondary" icon={Ic.eye} onClick={() => download(r.id)} disabled={dlBusy === r.id}>
                {dlBusy === r.id ? 'Loading…' : 'Download'}
              </Btn>
            )},
          ]}
          rows={contracts}
          empty="No contracts generated yet"
        />
      </div>
    </div>
  );
}

// ─── Section: Approvals ───────────────────────────────────────────────────────
function ApprovalsSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const serviceApprovals = (Array.isArray(data.serviceApprovals) ? data.serviceApprovals : []).filter((a: any) => a.status === 'PENDING' || a.status === 'PENDING_APPROVAL');
  const paymentApprovals = (Array.isArray(data.paymentApprovals) ? data.paymentApprovals : []).filter((p: any) => p.status === 'PENDING_APPROVAL');

  const act = async (url: string, method: 'post' = 'post') => {
    try { await apiClient[method](url, {}); refetch(['serviceApprovals', 'paymentApprovals']); } catch { /* silent */ }
  };

  return (
    <div className="space-y-5">
      {/* Service amount changes */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="Pricing Change Requests"
            sub="All pricing changes require CEO confirmation before taking effect" />
        </div>
        {serviceApprovals.length === 0
          ? <p className="px-5 py-8 text-center text-slate-400 text-sm">No pending pricing changes</p>
          : serviceApprovals.map((a: any) => (
            <div key={a.id} className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-4 last:border-0">
              <div>
                <p className="text-sm font-semibold text-slate-800">{a.serviceName || a.name || 'Service'}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Current: <span className="font-medium">KSh {(a.currentAmount || a.originalAmount || 0).toLocaleString()}</span>
                  {' → '}
                  Proposed: <span className="font-semibold text-blue-600">KSh {(a.newAmount || 0).toLocaleString()}</span>
                </p>
                {a.reason && <p className="text-xs text-slate-400 mt-0.5">Reason: {a.reason}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Btn size="sm" icon={Ic.check} onClick={() => act(`/api/v1/service-amounts/changes/${a.id}/confirm`)}>Confirm</Btn>
                <Btn size="sm" variant="danger" icon={Ic.x} onClick={() => act(`/api/v1/service-amounts/changes/${a.id}/reject`)}>Reject</Btn>
              </div>
            </div>
          ))
        }
      </div>

      {/* Payment approvals */}
      <div className={card}>
        <div className="p-5 border-b border-slate-100">
          <SectionTitle title="Payment Approvals" sub="CFO approves · EA executes — CEO can review all" />
        </div>
        <Table
          cols={[
            { key: 'purpose',    label: 'Purpose' },
            { key: 'amount',     label: 'Amount (KSh)', render: v => (v || 0).toLocaleString() },
            { key: 'requesterId', label: 'Requester' },
            { key: 'status',     label: 'Status',       render: v => <Badge status={v || 'PENDING'} /> },
            { key: 'createdAt',  label: 'Requested',    render: v => v ? new Date(v).toLocaleDateString() : '—' },
          ]}
          rows={paymentApprovals}
          empty="No pending payment approvals"
        />
      </div>
    </div>
  );
}

// ─── Section: Reports ─────────────────────────────────────────────────────────
function ReportsSection({ data }: { data: any }) {
  const dailyReports     = data.dailyReports     || [];
  const complianceReports = data.complianceReports || [];
  const [tab, setTab] = useState<'daily' | 'compliance'>('daily');

  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex border-b border-slate-100">
          {(['daily', 'compliance'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px capitalize"
              style={tab === t ? { borderColor: C.blue2, color: C.blue2 } : { borderColor: 'transparent', color: C.muted }}>
              {t === 'daily' ? 'Daily Reports' : 'Compliance Reports'}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === 'daily' && (
            <Table
              cols={[
                { key: 'user',       label: 'User',   render: (v, r) => v || r.userName || r.userId || '—' },
                { key: 'reportDate', label: 'Date',   render: v => v ? new Date(v).toLocaleDateString() : '—' },
                { key: 'status',     label: 'Status', render: (v, r) => <Badge status={v || (r.submitted ? 'SUBMITTED' : 'PENDING')} /> },
                { key: 'accomplishments', label: 'Summary', render: v => v ? String(v).slice(0, 60) + (String(v).length > 60 ? '…' : '') : '—' },
              ]}
              rows={dailyReports}
              empty="No daily reports submitted"
            />
          )}
          {tab === 'compliance' && (
            <Table
              cols={[
                { key: 'title',     label: 'Report' },
                { key: 'period',    label: 'Period' },
                { key: 'status',    label: 'Status', render: v => <Badge status={v || 'PENDING'} /> },
                { key: 'createdAt', label: 'Date',   render: v => v ? new Date(v).toLocaleDateString() : '—' },
              ]}
              rows={complianceReports}
              empty="No compliance reports"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Notifications ───────────────────────────────────────────────────
function NotificationsSection({ data }: { data: any }) {
  const notifs = data.notifications || [];
  return (
    <div className="space-y-3 max-w-2xl">
      {notifs.length === 0 && (
        <div className={`${card} p-12 text-center`}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: C.blueL }}>
            <span style={{ color: C.blue2 }}>{Ic.notif}</span>
          </div>
          <p className="text-slate-500 text-sm">No notifications</p>
        </div>
      )}
      {notifs.map((n: any, i: number) => (
        <div key={n.id || i} className={`${card} p-4 flex items-start gap-4 ${!n.read ? 'border-l-4' : ''}`}
          style={!n.read ? { borderLeftColor: C.blue2 } : {}}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: n.read ? '#f1f5f9' : C.blueL, color: n.read ? C.muted : C.blue2 }}>
            {Ic.notif}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{n.title || 'Notification'}</p>
            {n.message && <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>}
            <p className="text-xs text-slate-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</p>
          </div>
          {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: C.blue2 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── Section: System Admin ────────────────────────────────────────────────────
function AdminSection({ data, refetch }: { data: any; refetch: (k?: string[]) => void }) {
  const users = data.users || [];
  const [tab, setTab] = useState<'users' | 'config' | 'portals' | 'sessions'>('users');
  const [filter, setFilter] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');

  const suspend = async (id: string) => {
    try { await apiClient.post(`/api/v1/users/${id}/suspend`, { reason: 'Suspended by CEO' }); refetch(['users']); } catch { /* silent */ }
  };
  const saveRole = async (id: string) => {
    try { await apiClient.post(`/api/v1/users/${id}/role`, { role: editRole }); setEditId(null); refetch(['users']); } catch { /* silent */ }
  };
  const forceLogoutAll = async () => {
    try { await apiClient.post('/api/v1/admin/sessions/force-logout-all', {}); } catch { /* silent */ }
  };

  const filtered = users.filter((u: any) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (u.fullName || u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  const PORTALS = [
    { name: 'Portal 1 — CEO',        url: '/gatewayalpha',  roles: 'CEO' },
    { name: 'Portal 2 — Executive',  url: '/gatewaydelta',  roles: 'CoS, CFO, EA' },
    { name: 'Portal 3 — C-Level',    url: '/gatewaysigma',  roles: 'COO, CTO' },
    { name: 'Portal 4 — Operations', url: '/gatewaynexus',  roles: 'Ops, HoT, Trainer' },
    { name: 'Portal 5 — Technology', url: '/gatewayvertex', roles: 'Tech, Developer' },
    { name: 'Portal 6 — Agents',     url: '/gatewaypulse',  roles: 'Agent' },
  ];

  return (
    <div className="space-y-5">
      {/* Admin warning banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium"
        style={{ background: C.blueL, borderColor: '#bfdbfe', color: C.blue }}>
        {Ic.shield}
        CEO exclusive — this panel is not visible to any other role. Every action is logged and timestamped.
      </div>

      {/* Tabs */}
      <div className={card}>
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {(['users', 'config', 'portals', 'sessions'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px whitespace-nowrap capitalize"
              style={tab === t ? { borderColor: C.blue2, color: C.blue2 } : { borderColor: 'transparent', color: C.muted }}>
              {t === 'users' ? 'User Management' : t === 'config' ? 'System Config' : t === 'portals' ? 'Portal Access' : 'Sessions'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Users ── */}
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-500">{users.length} total accounts</p>
                <input value={filter} onChange={e => setFilter(e.target.value)}
                  placeholder="Search…"
                  className="w-52 px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
              </div>
              <Table
                cols={[
                  { key: 'fullName',  label: 'Name',   render: (v, r) => v || r.name || '—' },
                  { key: 'email',     label: 'Email' },
                  { key: 'role',      label: 'Role',   render: (v, r) => r.roleName || v || '—' },
                  { key: 'isActive',  label: 'Status', render: v => <Badge status={v === false ? 'SUSPENDED' : 'ACTIVE'} /> },
                  { key: 'id',        label: 'Actions', render: (_v, row) => (
                    <div className="flex items-center gap-2">
                      {editId === row.id ? (
                        <>
                          <select value={editRole} onChange={e => setEditRole(e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white">
                            {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <Btn size="sm" onClick={() => saveRole(row.id)}>Save</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Btn>
                        </>
                      ) : (
                        <>
                          <Btn size="sm" variant="secondary" onClick={() => { setEditId(row.id); setEditRole(row.role || ''); }}>Change Role</Btn>
                          <Btn size="sm" variant="danger" onClick={() => suspend(row.id)}>Suspend</Btn>
                        </>
                      )}
                    </div>
                  )},
                ]}
                rows={filtered}
                empty="No users found"
              />
            </div>
          )}

          {/* ── Config ── */}
          {tab === 'config' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 mb-4">Commitment amounts and service pricing. All changes require CEO confirmation before taking effect.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Full Payment Commitment',     value: 'KSh 500',   desc: 'Lead Activated' },
                  { label: '50/50 Commitment',            value: 'KSh 750',   desc: 'Lead Qualified' },
                  { label: 'Milestone Commitment',        value: 'KSh 1,000', desc: 'Lead Qualified' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-slate-100 p-4" style={{ background: '#f8fafc' }}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{item.label}</p>
                    <p className="text-xl font-bold text-slate-900">{item.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl border border-amber-100 bg-amber-50 text-sm text-amber-700 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                To change pricing, use the Finance → Service Amounts section. Changes are held as pending until you confirm.
              </div>
            </div>
          )}

          {/* ── Portals ── */}
          {tab === 'portals' && (
            <div className="space-y-3">
              {PORTALS.map(p => (
                <div key={p.url} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{p.url}</code>
                      <span className="ml-2">{p.roles}</span>
                    </p>
                  </div>
                  <Badge status="ACTIVE" />
                </div>
              ))}
            </div>
          )}

          {/* ── Sessions ── */}
          {tab === 'sessions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">View and manage all active user sessions.</p>
                <Btn variant="danger" icon={Ic.x} onClick={forceLogoutAll}>Force Logout All</Btn>
              </div>
              <div className="p-8 text-center rounded-xl border border-slate-100 text-slate-400 text-sm">
                Session data loads from the backend. Connect the API to view live sessions.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function CEOPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');

  const { data, loading, refetch } = useMultiPortalData([
    { key: 'metrics',            endpoint: '/api/v1/dashboard/metrics',           fallback: {} },
    { key: 'serviceApprovals',   endpoint: '/api/v1/approvals/service-amounts',   fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.approvals || [] },
    { key: 'auditLog',           endpoint: '/api/v1/audit-logs',                  fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.logs || r.data || [] },
    { key: 'users',              endpoint: '/api/v1/users',                       fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.users || [] },
    { key: 'serviceAmounts',     endpoint: '/api/v1/service-amounts',             fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'paymentApprovals',   endpoint: '/api/v1/payments/approvals/pending',  fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.approvals || [] },
    { key: 'complianceReports',  endpoint: '/api/v1/reports/compliance',          fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'clients',            endpoint: '/api/v1/clients',                     fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.clients || [] },
    { key: 'properties',         endpoint: '/api/v1/properties',                  fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.properties || [] },
    { key: 'projects',           endpoint: '/api/v1/projects',                    fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || r.projects || [] },
    { key: 'repos',              endpoint: '/api/v1/github/repos',                fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'commissions',        endpoint: '/api/v1/commissions',                 fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'contracts',          endpoint: '/api/v1/contracts',                   fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'notifications',      endpoint: '/api/v1/notifications',               fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.data || [] },
    { key: 'dailyReports',       endpoint: '/api/v1/reports/team',                fallback: [], transform: (r: any) => Array.isArray(r) ? r : r.reports || r.data || [] },
  ] as any);

  const d = data as any;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading CEO Portal…</p>
        </div>
      </div>
    );
  }

  if (!user) { navigate('/login'); return null; }

  const unread       = Array.isArray(d.notifications)   ? d.notifications.filter((n: any) => !n.read).length : 0;
  const pendingCount = (Array.isArray(d.serviceApprovals) ? d.serviceApprovals.filter((a: any) => a.status === 'PENDING' || a.status === 'PENDING_APPROVAL').length : 0)
                     + (Array.isArray(d.paymentApprovals)  ? d.paymentApprovals.filter((p: any) => p.status === 'PENDING_APPROVAL').length : 0);

  const handleLogout = () => { logout(); navigate('/login'); };

  const sectionProps = { data: d, refetch };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar
        section={section}
        setSection={setSection}
        unread={unread}
        pendingCount={pendingCount}
        user={user}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar section={section} unread={unread} setSection={setSection} />

        <main className="flex-1 overflow-y-auto p-6">
          {section === 'overview'       && <OverviewSection      {...sectionProps} />}
          {section === 'finance'        && <FinanceSection       {...sectionProps} />}
          {section === 'sales'          && <SalesSection         {...sectionProps} />}
          {section === 'operations'     && <OperationsSection    {...sectionProps} />}
          {section === 'people'         && <PeopleSection        {...sectionProps} />}
          {section === 'contracts'      && <ContractsSection     {...sectionProps} />}
          {section === 'approvals'      && <ApprovalsSection     {...sectionProps} />}
          {section === 'reports'        && <ReportsSection       {...sectionProps} />}
          {section === 'notifications'  && <NotificationsSection {...sectionProps} />}
          {section === 'admin'          && <AdminSection         {...sectionProps} />}
        </main>
      </div>
    </div>
  );
}
