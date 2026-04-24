import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from '../shared/utils/router';
import { useAuth, getPortalForRole, ROLE_PORTAL_MAP } from '../shared/components/auth/AuthContext';
import { PORTAL_THEMES } from '../shared/theme/portalThemes';
import TSTLogo, { TSTEmblem } from '../../shared/components/TSTLogo';

// Map portal path → theme id (spec §3 gateway URL naming)
const PATH_THEME: Record<string, string> = {
  '/gatewayalpha':  'ceo',
  '/gatewaydelta':  'executive',
  '/gatewaysigma':  'clevel',
  '/gatewaynexus':  'operations',
  '/gatewayvertex': 'technology',
  '/gatewaypulse':  'agents',
};

// Quick-fill credentials for dev
const DEV_CREDS: { label: string; email: string; password: string; portal: string }[] = [
  { label: 'CEO',          email: 'ceo@tst.com',          password: 'Ceo@123456789!',  portal: '/gatewayalpha' },
  { label: 'CFO',          email: 'cfo@tst.com',          password: 'Cfo@123456789!',  portal: '/gatewaydelta' },
  { label: 'CoS',          email: 'cos@tst.com',          password: 'Cos@123456789!',  portal: '/gatewaydelta' },
  { label: 'EA',           email: 'ea@tst.com',           password: 'Ea@1234567890!',  portal: '/gatewaydelta' },
  { label: 'COO',          email: 'coo@tst.com',          password: 'Coo@123456789!',  portal: '/gatewaysigma' },
  { label: 'CTO',          email: 'cto@tst.com',          password: 'Cto@123456789!',  portal: '/gatewaysigma' },
  { label: 'Operations',   email: 'ops@tst.com',          password: 'Ops@123456789!',  portal: '/gatewaynexus' },
  { label: 'Head Trainer', email: 'headtrainer@tst.com',  password: 'Head@12345678!',  portal: '/gatewaynexus' },
  { label: 'Trainer',      email: 'trainer@tst.com',      password: 'Train@1234567!',  portal: '/gatewaynexus' },
  { label: 'Tech Lead',    email: 'tech@tst.com',         password: 'Tech@12345678!',  portal: '/gatewayvertex' },
  { label: 'Developer',    email: 'dev@tst.com',          password: 'Dev@123456789!',  portal: '/gatewayvertex' },
  { label: 'Agent',        email: 'agent@tst.com',        password: 'Agent@1234567!',  portal: '/gatewaypulse' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();

  // The portal the user was trying to access
  const from: string = (location.state as any)?.from?.pathname || '/';
  const themeId = PATH_THEME[from] || 'ceo';
  const theme = PORTAL_THEMES[themeId];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // If already authenticated, redirect to their portal
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getPortalForRole(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success && result.portalPath) {
      navigate(result.portalPath, { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const fillCreds = (cred: typeof DEV_CREDS[0]) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setError('');
  };

  return (
    <div className="min-h-screen flex" style={{ background: `linear-gradient(135deg, ${theme.hex}15 0%, #f8fafc 100%)` }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-5/12 flex-col items-center justify-center p-12 text-white relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${theme.hex} 0%, ${theme.hex}dd 100%)` }}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white"
              style={{ width: `${(i + 1) * 120}px`, height: `${(i + 1) * 120}px`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          ))}
        </div>
        <div className="relative text-center max-w-xs">
          <TSTEmblem size={80} className="mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">TechSwiftTrix ERP</h1>
          <p className="text-white/80 text-lg font-medium mb-1">{theme.name}</p>
          <p className="text-white/50 text-sm leading-relaxed">
            Enterprise Resource Planning for modern African businesses
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            {Object.entries(ROLE_PORTAL_MAP).slice(0, 6).map(([role, path]) => (
              <div key={role} className="bg-white/10 rounded-xl px-3 py-2">
                <p className="text-white/90 text-xs font-semibold">{role}</p>
                <p className="text-white/50 text-xs">{path}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
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
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@tst.com"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all" style={{ background: "linear-gradient(145deg, #e8ecf8, #f0f4ff)", boxShadow: "inset 3px 3px 6px #c8cde0, inset -3px -3px 6px #ffffff", border: "none", outline: "none" }}
                  style={{ '--tw-ring-color': theme.hex } as any}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all pr-12" style={{ background: "linear-gradient(145deg, #e8ecf8, #f0f4ff)", boxShadow: "inset 3px 3px 6px #c8cde0, inset -3px -3px 6px #ffffff", border: "none", outline: "none" }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw
                      ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: theme.hex }}>
                {loading
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing in…</>
                  : 'Sign in to your portal'}
              </button>
            </form>

            {/* Quick-fill dev credentials */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick access — dev credentials</p>
              <div className="grid grid-cols-3 gap-1.5">
                {DEV_CREDS.map((c) => (
                  <button key={c.email} onClick={() => fillCreds(c)}
                    className="text-xs px-2 py-1.5 rounded-lg border border-gray-100 text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-all text-left truncate">
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 text-center">
              <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                ← Portal directory
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
