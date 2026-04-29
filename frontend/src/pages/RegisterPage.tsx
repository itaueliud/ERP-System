import { useState, useEffect } from 'react';
import { Register } from '../shared/components/auth/Register';
import { apiClient } from '../shared/api/apiClient';

export default function RegisterPage() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [requiresPayout, setRequiresPayout] = useState(false);
  const [role, setRole] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [validating, setValidating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [presetPayout, setPresetPayout] = useState<{
    payoutMethod?: string; payoutPhone?: string; payoutBankName?: string; payoutBankAccount?: string;
  }>({});

  // Extract token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    if (t) {
      setToken(t);
      validateToken(t);
    }
  }, []);

  const validateToken = async (t: string) => {
    setValidating(true);
    setTokenError('');
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { email: string; role: string; requiresPayout: boolean; expiresAt: string; payoutMethod?: string; payoutPhone?: string; payoutBankName?: string; payoutBankAccount?: string };
      }>(`/api/v1/users/invite/validate/${t}`);
      const d = res.data.data;
      setEmail(d.email);
      setRole(d.role);
      setRequiresPayout(d.requiresPayout);
      if (d.payoutMethod) {
        setPresetPayout({ payoutMethod: d.payoutMethod, payoutPhone: d.payoutPhone, payoutBankName: d.payoutBankName, payoutBankAccount: d.payoutBankAccount });
      }
    } catch (err: any) {
      setTokenError(err?.response?.data?.error || 'Invalid or expired invitation link.');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (data: {
    name: string;
    email: string;
    password: string;
    payoutMethod?: 'MPESA' | 'BANK';
    payoutPhone?: string;
    payoutBankName?: string;
    payoutBankAccount?: string;
  }) => {
    setIsLoading(true);
    setError('');
    try {
      await apiClient.post('/api/v1/users/register', {
        token,
        email: data.email,
        password: data.password,
        fullName: data.name,
        phone: '',   // user can update in profile
        country: '', // user can update in profile
        payoutMethod: data.payoutMethod,
        payoutPhone: data.payoutPhone,
        payoutBankName: data.payoutBankName,
        payoutBankAccount: data.payoutBankAccount,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Validating invitation…</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-sm text-gray-600">{tokenError}</p>
          <p className="text-xs text-gray-400 mt-4">Contact your administrator for a new invitation link.</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No Invitation Found</h1>
          <p className="text-sm text-gray-600">Please use the invitation link sent to your email.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-green-500 text-4xl mb-4">✓</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Account Created</h1>
          <p className="text-sm text-gray-600 mb-4">
            Your account has been created successfully.
            {role && <span> You have been assigned the <strong>{role}</strong> role.</span>}
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <Register
      onSubmit={handleSubmit}
      onLogin={() => { window.location.href = '/login'; }}
      isLoading={isLoading}
      error={error}
      requiresPayout={requiresPayout}
      defaultEmail={email}
      presetPayout={presetPayout}
    />
  );
}
