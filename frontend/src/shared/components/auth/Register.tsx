import { useState, FormEvent } from 'react';

export interface RegisterProps {
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    payoutMethod?: 'MPESA' | 'BANK';
    payoutPhone?: string;
    payoutBankName?: string;
    payoutBankAccount?: string;
  }) => void | Promise<void>;
  onLogin?: () => void;
  isLoading?: boolean;
  error?: string;
  requiresPayout?: boolean;
  defaultEmail?: string;
  presetPayout?: { payoutMethod?: string; payoutPhone?: string; payoutBankName?: string; payoutBankAccount?: string };
}

export function Register({ onSubmit, onLogin, isLoading, error, requiresPayout = false, defaultEmail = '', presetPayout }: RegisterProps) {
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState(defaultEmail);
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'MPESA' | 'BANK'>((presetPayout?.payoutMethod as 'MPESA' | 'BANK') || 'MPESA');
  const [payoutPhone, setPayoutPhone] = useState(presetPayout?.payoutPhone || '');
  const [payoutBankName, setPayoutBankName]       = useState(presetPayout?.payoutBankName || '');
  const [payoutBankAccount, setPayoutBankAccount] = useState(presetPayout?.payoutBankAccount || '');
  const [localError, setLocalError]   = useState('');

  // Derived: is the payout section complete?
  const payoutComplete =
    !requiresPayout ||
    (payoutMethod === 'MPESA' && payoutPhone.trim().length >= 9) ||
    (payoutMethod === 'BANK'  && payoutBankName.trim() !== '' && payoutBankAccount.trim() !== '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirm) {
      setLocalError('Passwords do not match');
      return;
    }

    if (requiresPayout) {
      if (!payoutMethod) {
        setLocalError('Select a payout method (M-Pesa or Bank)');
        return;
      }
      if (payoutMethod === 'MPESA' && !payoutPhone.trim()) {
        setLocalError('M-Pesa phone number is required to receive payments');
        return;
      }
      if (payoutMethod === 'BANK') {
        if (!payoutBankName.trim()) {
          setLocalError('Bank name is required');
          return;
        }
        if (!payoutBankAccount.trim()) {
          setLocalError('Bank account number is required');
          return;
        }
      }
    }

    onSubmit({
      name,
      email,
      password,
      ...(requiresPayout && {
        payoutMethod,
        payoutPhone:      payoutMethod === 'MPESA' ? payoutPhone.trim()      : undefined,
        payoutBankName:   payoutMethod === 'BANK'  ? payoutBankName.trim()   : undefined,
        payoutBankAccount:payoutMethod === 'BANK'  ? payoutBankAccount.trim(): undefined,
      }),
    });
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Create Account</h1>
        {requiresPayout && (
          <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
            Your role requires a payout account — you must enter your M-Pesa number or bank details to receive payments.
          </p>
        )}

        {displayError && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Personal Details ── */}
          <div className="mb-4">
            <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="reg-name" type="text" autoComplete="name" required
              value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="reg-email" type="email" autoComplete="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="reg-password" type="password" autoComplete="new-password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Min 12 chars, uppercase, lowercase, number, special character</p>
          </div>

          <div className="mb-6">
            <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              id="reg-confirm" type="password" autoComplete="new-password" required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* ── Payout Details — REQUIRED for payable roles ── */}
          {requiresPayout && (
            <div className="mb-6 rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span className="text-sm font-bold text-blue-800">
                  Payout Account <span className="text-red-500">*</span>
                </span>
                <span className="text-xs text-blue-600 font-normal">— required to receive payments</span>
              </div>

              {/* Method selector */}
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['MPESA', 'BANK'] as const).map(m => (
                    <label
                      key={m}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        payoutMethod === m
                          ? 'border-blue-500 bg-white shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payoutMethod"
                        value={m}
                        checked={payoutMethod === m}
                        onChange={() => setPayoutMethod(m)}
                        className="text-blue-600"
                        required
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {m === 'MPESA' ? 'M-Pesa' : 'Bank Transfer'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {m === 'MPESA' ? 'Mobile money' : 'Bank account'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* M-Pesa phone */}
              {payoutMethod === 'MPESA' && (
                <div>
                  <label htmlFor="reg-payout-phone" className="block text-sm font-medium text-gray-700 mb-1">
                    M-Pesa Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-payout-phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    placeholder="e.g. 0712345678"
                    value={payoutPhone}
                    onChange={e => setPayoutPhone(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                      payoutPhone.trim() ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50'
                    }`}
                  />
                  {!payoutPhone.trim() && (
                    <p className="text-xs text-red-500 mt-1">Required — this is where your payments will be sent</p>
                  )}
                </div>
              )}

              {/* Bank details */}
              {payoutMethod === 'BANK' && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="reg-bank-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="reg-bank-name"
                      type="text"
                      required
                      placeholder="e.g. Equity Bank"
                      value={payoutBankName}
                      onChange={e => setPayoutBankName(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                        payoutBankName.trim() ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50'
                      }`}
                    />
                    {!payoutBankName.trim() && (
                      <p className="text-xs text-red-500 mt-1">Required</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="reg-bank-account" className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="reg-bank-account"
                      type="text"
                      required
                      placeholder="e.g. 0123456789"
                      value={payoutBankAccount}
                      onChange={e => setPayoutBankAccount(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                        payoutBankAccount.trim() ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50'
                      }`}
                    />
                    {!payoutBankAccount.trim() && (
                      <p className="text-xs text-red-500 mt-1">Required</p>
                    )}
                  </div>
                </div>
              )}

              {/* Completion indicator */}
              <div className={`mt-3 flex items-center gap-2 text-xs font-medium ${payoutComplete ? 'text-green-700' : 'text-red-600'}`}>
                {payoutComplete ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Payout account set — you can proceed
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Fill in your payout details above to continue
                  </>
                )}
              </div>

              <p className="text-xs text-blue-600 mt-2 border-t border-blue-200 pt-2">
                Only your supervisor can change this after registration.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (requiresPayout && !payoutComplete)}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
          >
            {isLoading ? 'Creating account…' : 'Create Account'}
          </button>

          {requiresPayout && !payoutComplete && (
            <p className="text-xs text-center text-red-500 mt-2">
              Complete your payout details above to enable account creation
            </p>
          )}
        </form>

        {onLogin && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <button onClick={onLogin} className="text-blue-600 hover:underline font-medium">Sign in</button>
          </p>
        )}
      </div>
    </div>
  );
}

export default Register;
