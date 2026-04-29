/**
 * Shared login page template — modern flat government-portal style.
 * Used by all 6 portals. Inspired by IEBC, HELB, eCitizen Kenya.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from '../../utils/router';
import { TSTEmblem } from '../TSTLogo';

interface LoginTemplateProps {
  allowedRoles: string[];
  portalName: string;
  portalDescription: string;
  primaryColor: string;       // hex e.g. '#1d4ed8'
  sidebarColor: string;       // hex e.g. '#0f2557'
  accentColor: string;        // hex e.g. '#f59e0b'
  features: string[];
  devCreds: { label: string; email: string; password: string }[];
}

export default function LoginTemplate({
  allowedRoles, portalName, portalDescription,
  primaryColor, sidebarColor, accentColor, features, devCreds,
}: LoginTemplateProps) {
  const { isAuthenticated, user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (allowedRoles.includes(user.role)) navigate('/', { replace: true });
      else { logout(); setError(`This portal is for ${allowedRoles.join(', ')} only.`); }
    }
  }, [isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    const r = await login(email, password);
    if (!r.success) setError(r.error ?? 'Login failed. Check your credentials.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f1f5f9' }}>

      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[460px] flex-col justify-between p-10 relative overflow-hidden"
        style={{ backgroundColor: sidebarColor }}>

        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accentColor }} />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor }}>
            <TSTEmblem size={24} />
          </div>
          <div>
            <p className="text-white font-bold text-sm">TechSwiftTrix ERP</p>
            <p className="text-white/50 text-xs">Enterprise Resource Platform</p>
          </div>
        </div>

        {/* Centre content */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-xs font-bold"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor, border: `1px solid ${accentColor}40` }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
            {portalName}
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            Secure<br />Access Portal
          </h1>
          <p className="text-white/50 text-sm leading-relaxed mb-8">{portalDescription}</p>

          <div className="space-y-3">
            {features.map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${accentColor}30` }}>
                  <svg className="w-3 h-3" style={{ color: accentColor }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white/60 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-white/40 text-xs">System operational</span>
          </div>
          <p className="text-white/25 text-xs">© {new Date().getFullYear()} TechSwiftTrix · All rights reserved</p>
        </div>
      </div>

      {/* ── Right panel — form ───────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
              <TSTEmblem size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">TechSwiftTrix ERP</p>
              <p className="text-slate-500 text-xs">{portalName}</p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Card top accent */}
            <div className="h-1" style={{ backgroundColor: primaryColor }} />

            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Sign in</h2>
                <p className="text-slate-500 text-sm mt-1">Enter your credentials to access {portalName}</p>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="you@tst.com" autoComplete="email"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    style={{ '--tw-ring-color': primaryColor } as any} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="••••••••••••" autoComplete="current-password"
                      className="w-full px-4 py-3 pr-11 rounded-lg border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ '--tw-ring-color': primaryColor } as any} />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPw
                        ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      }
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                  style={{ backgroundColor: primaryColor }}>
                  {loading
                    ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing in…</>
                    : <>Sign in <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                  }
                </button>
              </form>

              {/* Dev quick-fill */}
              {devCreds.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-2 font-medium">Dev quick-fill</p>
                  <div className="flex flex-wrap gap-1.5">
                    {devCreds.map(c => (
                      <button key={c.email} onClick={() => { setEmail(c.email); setPassword(c.password); }}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            Secured with JWT + 2FA · TechSwiftTrix ERP v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
