/**
 * PortalLayout — Modern flat design system
 * Inspired by IEBC, HELB, eCitizen Kenya portals.
 * Clean white cards, strong sidebar, accessible colors, no glassmorphism.
 * Chat panel is a collapsible right-side drawer — not a floating overlay.
 */
import React, { useState } from 'react';
import type { PortalTheme } from '../../theme/portalThemes';
import { TSTEmblem } from '../TSTLogo';
import type { FAQCategory } from './FAQPanel';
import { FAQPanel } from './FAQPanel';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NavItem { id: string; label: string; icon: React.ReactNode; badge?: number; }
export interface PortalUser { name: string; email: string; role: string; avatarUrl?: string; }
export interface PortalLayoutProps {
  theme: PortalTheme; user: PortalUser; navItems: NavItem[];
  activeSection: string; onSectionChange: (id: string) => void;
  onLogout?: () => void; children: React.ReactNode;
  portalName?: string;
  notifications?: any[];
  onNotificationRead?: (id: string) => void;
  /** FAQ data — when provided a ? button appears in the top bar */
  faqs?: FAQCategory[];
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export interface StatCardProps {
  label: string; value: string | number; icon?: React.ReactNode;
  trend?: { value: number; up: boolean }; color?: string;
}
export function StatCard({ label, value, icon, trend, color = '#1d4ed8' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        {icon && (
          <span className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: color }}>
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${trend.up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {trend.up ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Portal Button ────────────────────────────────────────────────────────────
export function PortalButton({ children, onClick, variant = 'primary', size = 'md', color, disabled, fullWidth, icon }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg'; color?: string; disabled?: boolean; fullWidth?: boolean; icon?: React.ReactNode;
}) {
  const sz = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }[size];
  const base = `inline-flex items-center gap-2 font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1
    ${sz} ${fullWidth ? 'w-full justify-center' : ''}
    ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`;

  const styles: Record<string, React.CSSProperties> = {
    primary:   { backgroundColor: color || '#1d4ed8', color: '#fff' },
    secondary: { backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' },
    ghost:     { backgroundColor: 'transparent', color: '#475569' },
    danger:    { backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' },
  };

  return (
    <button onClick={onClick} disabled={disabled} style={disabled ? {} : styles[variant]} className={base}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

// ─── Data Table ───────────────────────────────────────────────────────────────
export function DataTable<T extends Record<string, any>>({ columns, rows, emptyMessage = 'No data' }: {
  columns: { key: string; label: string; render?: (val: any, row: T) => React.ReactNode }[];
  rows: T[]; emptyMessage?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-slate-400 text-sm">{emptyMessage}</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toUpperCase();
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    EXECUTED: 'bg-green-100 text-green-800',
    CLOSED_WON: 'bg-green-100 text-green-800',
    VERIFIED: 'bg-green-100 text-green-800',
    FILED: 'bg-green-100 text-green-800',
    PENDING: 'bg-amber-100 text-amber-800',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
    PENDING_COMMITMENT: 'bg-orange-100 text-orange-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    DRAFT: 'bg-slate-100 text-slate-600',
    NOT_STARTED: 'bg-slate-100 text-slate-600',
    FAILED: 'bg-red-100 text-red-700',
    REJECTED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-slate-100 text-slate-600',
    SUSPENDED: 'bg-red-100 text-red-700',
    NEW_LEAD: 'bg-purple-100 text-purple-800',
    CONVERTED: 'bg-indigo-100 text-indigo-800',
    LEAD_ACTIVATED: 'bg-blue-100 text-blue-800',
    LEAD_QUALIFIED: 'bg-cyan-100 text-cyan-800',
    NEGOTIATION: 'bg-orange-100 text-orange-800',
    PUBLISHED: 'bg-green-100 text-green-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    OVERDUE: 'bg-red-100 text-red-700',
  };
  const cls = map[s] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${cls}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
}

// ─── Portal Layout ────────────────────────────────────────────────────────────
export function PortalLayout({
  theme, user, navItems, activeSection, onSectionChange, onLogout, children, portalName,
  notifications = [], onNotificationRead, faqs,
}: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [faqOpen, setFaqOpen]         = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user.name });
  const [profileMsg, setProfileMsg]   = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const initials   = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const showLabels = sidebarOpen || mobileOpen;

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg('');
    try {
      const { apiClient } = await import('../../api/apiClient');
      await apiClient.put('/api/v1/users/me', { fullName: profileForm.name });
      setProfileMsg('Profile updated!');
    } catch { setProfileMsg('Failed to save'); }
    finally { setProfileSaving(false); }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`fixed lg:relative z-[60] lg:z-auto flex flex-col h-full transition-all duration-300
          ${sidebarOpen ? 'lg:w-60' : 'lg:w-16'} w-60
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ backgroundColor: theme.sidebarHex || '#0f2557', borderRight: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
          <TSTEmblem size={showLabels ? 32 : 26} className="flex-shrink-0" />
          {showLabels && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight truncate">TechSwiftTrix</p>
              <p className="text-white/50 text-xs truncate">{theme.name}</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(item => {
            const active = item.id === activeSection;
            return (
              <button key={item.id} onClick={() => { onSectionChange(item.id); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={active
                  ? { backgroundColor: theme.accentHex || '#f59e0b', color: '#fff' }
                  : { color: 'rgba(255,255,255,0.65)' }
                }
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; } }}
                title={!showLabels ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <span className="flex-shrink-0 w-5 h-5">{item.icon}</span>
                {showLabels && <span className="flex-1 text-left truncate">{item.label}</span>}
                {showLabels && item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center bg-red-500 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/10">
          <div className={`flex items-center gap-2.5 ${showLabels ? '' : 'justify-center'}`}>
            <button onClick={() => setProfileOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: theme.accentHex || '#f59e0b' }}>
              {initials}
            </button>
            {showLabels && (
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setProfileOpen(true)}>
                <p className="text-white text-xs font-semibold truncate">{user.name}</p>
                <p className="text-white/40 text-[10px] truncate">{user.role}</p>
              </div>
            )}
            {showLabels && onLogout && (
              <button onClick={onLogout} className="text-white/40 hover:text-red-400 transition-colors p-1 rounded" title="Sign out">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setSidebarOpen(o => !o)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 rounded-full items-center justify-center bg-white border border-slate-200 text-slate-500 hover:text-slate-700 shadow-sm transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
          <svg className={`w-3 h-3 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(o => !o)} className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Portal badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: theme.hex }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
              {theme.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Date */}
            <span className="hidden sm:block text-xs text-slate-400 font-medium">
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {/* Help / FAQ button */}
            {faqs && (
              <button
                onClick={() => { setFaqOpen(o => !o); setNotifOpen(false); }}
                className={`p-2 rounded-lg transition-colors ${faqOpen ? 'text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                style={faqOpen ? { backgroundColor: theme.hex } : {}}
                aria-label="Help & FAQ"
                title="Help & FAQ"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
            {/* Notifications bell */}
            {(() => {
              const unread = notifications.filter((n: any) => !n.read).length;
              return (
                <div className="relative">
                  <button
                    onClick={() => { setNotifOpen(o => !o); setFaqOpen(false); }}
                    className={`relative p-2 rounded-lg transition-colors ${notifOpen ? 'text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    style={notifOpen ? { backgroundColor: theme.hex } : {}}
                    aria-label="Notifications"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unread > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-[55]" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-slate-200 shadow-xl z-[60] overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                          <p className="text-sm font-bold text-slate-800">Notifications</p>
                          {unread > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{unread} unread</span>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                          {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                              <p className="text-sm text-slate-400">No notifications</p>
                            </div>
                          ) : notifications.map((n: any, i: number) => (
                            <div key={n.id || i} className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/40' : ''}`}>
                              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-slate-300' : 'bg-blue-500'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 leading-snug">{n.title || 'Notification'}</p>
                                {n.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                                {n.createdAt && <p className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>}
                              </div>
                              {!n.read && onNotificationRead && (
                                <button
                                  onClick={() => onNotificationRead(n.id)}
                                  className="text-[10px] font-semibold flex-shrink-0 mt-0.5 hover:underline"
                                  style={{ color: theme.hex }}>
                                  Mark read
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* User */}
            <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: theme.hex }}>
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{user.name}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{user.role}</p>
              </div>
            </button>
          </div>
        </header>

        {/* Page content + chat side panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-5">
            {children}
          </main>
        </div>
      </div>

      {/* ── FAQ slide-in panel ──────────────────────────────────────────────── */}
      {faqOpen && faqs && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setFaqOpen(false)} />
          <div className="relative w-full sm:max-w-lg h-full flex flex-col bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0"
              style={{ borderTop: `3px solid ${theme.hex}` }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: theme.hex }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Help & FAQ</h2>
                  <p className="text-[10px] text-slate-400">{portalName || theme.name}</p>
                </div>
              </div>
              <button onClick={() => setFaqOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                aria-label="Close FAQ">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <FAQPanel faqs={faqs} accentColor={theme.hex} portalName={portalName || theme.name} />
            </div>
          </div>
        </div>
      )}

      {/* ── Profile panel ───────────────────────────────────────────────────── */}
      {profileOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProfileOpen(false)} />
          <div className="relative w-full max-w-xs h-full flex flex-col bg-white shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">My Profile</h2>
              <button onClick={() => setProfileOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex flex-col items-center py-6 px-5 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2"
                style={{ backgroundColor: theme.hex }}>
                {initials}
              </div>
              <p className="font-bold text-slate-900">{user.name}</p>
              <span className="mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full text-white" style={{ backgroundColor: theme.hex }}>{user.role}</span>
            </div>
            <div className="flex-1 px-5 py-5 space-y-4">
              {profileMsg && <div className={`p-3 rounded-lg text-sm ${profileMsg.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{profileMsg}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input type="text" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': theme.hex } as any} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={user.email} readOnly className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm bg-slate-100 text-slate-500 cursor-not-allowed" />
              </div>
              <button onClick={saveProfile} disabled={profileSaving}
                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: theme.hex }}>
                {profileSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
            {onLogout && (
              <div className="px-5 pb-5">
                <button onClick={() => { setProfileOpen(false); onLogout(); }}
                  className="w-full py-2.5 rounded-lg text-red-600 text-sm font-semibold border border-red-200 hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PortalLayout;
