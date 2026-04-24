import React, { useState, useEffect } from 'react';
import { useAuth } from '../../shared/components/auth/AuthContext';
import { useNavigate } from '../../shared/utils/router';
import { PORTAL_THEMES } from '../../shared/theme/portalThemes';
import TSTLogo, { TSTEmblem } from '../../shared/components/TSTLogo';

const ALLOWED_ROLES = ['AGENT'];
const theme = PORTAL_THEMES.agents;
const DEV_CREDS = [{ label: "Agent", email: "agent@tst.com", password: "Agent@1234567!" }];

export default function AgentsLoginPage() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (ALLOWED_ROLES.includes(user.role)) { navigate('/', { replace: true }); }
      else { logout(); setError(`This portal is for ${ALLOWED_ROLES.join(', ')} accounts only`); }
    }
  }, [isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    const result = await login(email, password);
    if (!result.success) setError(result.error ?? 'Login failed');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: `linear-gradient(135deg, ${theme.hex}15 0%, #f8fafc 100%)` }}>
      <div className="hidden lg:flex lg:w-5/12 flex-col items-center justify-center p-12 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${theme.hex} 0%, ${theme.hex}cc 100%)` }}>
        <div className="absolute inset-0 opacity-10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white"
              style={{ width: `${(i+1)*120}px`, height: `${(i+1)*120}px`, top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />
          ))}
        </div>
        <div className="relative text-center max-w-xs">
          <TSTEmblem size={80} className="mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">TechSwiftTrix ERP</h1>
          <p className="text-white/80 text-lg font-medium mb-1">{theme.name}</p>
          <p className="text-white/50 text-sm leading-relaxed">Client capture, commissions, performance &amp; training</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <TSTEmblem size={56} className="mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">TechSwiftTrix ERP</h1>
            <p className="text-sm text-gray-500">{theme.name}</p>
          </div>
          <div className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 20px 60px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)" }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h2>
            <p className="text-gray-500 text-sm mb-6">Access your role-based portal</p>
            {error && (
              <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@tst.com"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all" style={{ background: "linear-gradient(145deg, #e8ecf8, #f0f4ff)", boxShadow: "inset 3px 3px 6px #c8cde0, inset -3px -3px 6px #ffffff", border: "none", outline: "none" }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all pr-12" style={{ background: "linear-gradient(145deg, #e8ecf8, #f0f4ff)", boxShadow: "inset 3px 3px 6px #c8cde0, inset -3px -3px 6px #ffffff", border: "none", outline: "none" }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showPw ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>}
                    </svg>
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: theme.hex }}>
                {loading ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing in…</> : 'Sign in to your portal'}
              </button>
            </form>
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Quick fill — dev</p>
              <div className="flex gap-1.5 flex-wrap">
                {DEV_CREDS.map(c => (
                  <button key={c.email} onClick={() => { setEmail(c.email); setPassword(c.password); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-100 text-gray-600 hover:border-gray-300 transition-all">
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
