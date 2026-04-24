import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useNavigate } from '../../shared/utils/router';
import { TSTEmblem } from '../../shared/components/TSTLogo';

const ALLOWED_ROLES = ['CEO'];

// ─── Brand colours ────────────────────────────────────────────────────────────
const NAVY   = '#0f172a';
const BLUE   = '#1d4ed8';
const BLUE2  = '#2563eb';
const LIGHT  = '#eff6ff';

export default function CEOLoginPage() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (ALLOWED_ROLES.includes(user.role)) navigate('/', { replace: true });
      else { logout(); setError('This portal is for CEO accounts only.'); }
    }
  }, [isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    const r = await login(email, password);
    if (!r.success) setError(r.error ?? 'Login failed');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#f1f5f9' }}>

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1e3a5f 100%)` }}>

        {/* grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* top brand */}
        <div className="relative flex items-center gap-3">
          <TSTEmblem size={36} />
          <div>
            <p className="text-white font-bold text-sm tracking-wide">TechSwiftTrix</p>
            <p className="text-blue-300 text-xs">Enterprise Resource Platform</p>
          </div>
        </div>

        {/* centre content */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-semibold text-blue-200"
            style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            CEO / System Administrator
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Command<br />Centre
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Full system visibility — revenue, approvals, audit logs, people management and strategic oversight across all 54 African countries.
          </p>

          {/* feature pills */}
          <div className="mt-8 flex flex-col gap-2">
            {[
              { icon: '📊', text: 'Real-time P&L and revenue dashboards' },
              { icon: '✅', text: 'Payment and pricing approvals queue' },
              { icon: '🔐', text: 'Full audit log and session control' },
              { icon: '🌍', text: 'Cross-country performance analytics' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-base">{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        {/* bottom */}
        <div className="relative">
          <p className="text-slate-500 text-xs">© {new Date().getFullYear()} TechSwiftTrix · Jupiter Stack</p>
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <TSTEmblem size={40} />
            <div>
              <p className="font-bold text-gray-900">TechSwiftTrix ERP</p>
              <p className="text-xs text-gray-500">CEO Portal</p>
            </div>
          </div>

          {/* card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 p-8 border border-slate-100">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="text-gray-500 text-sm mt-1">Sign in to your administrator portal</p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="ceo@tst.com" autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': BLUE2 } as any} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••••••" autoComplete="current-password"
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    style={{ '--tw-ring-color': BLUE2 } as any} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPw
                      ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE2} 100%)`, boxShadow: `0 4px 14px ${BLUE}55` }}>
                {loading
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing in…</>
                  : <>Sign in to CEO Portal<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                }
              </button>
            </form>

            {/* dev quick-fill */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Dev quick-fill</p>
              <button onClick={() => { setEmail('ceo@tst.com'); setPassword('Ceo@123456789!'); }}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                CEO credentials
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Secured with JWT + 2FA · TechSwiftTrix ERP v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
