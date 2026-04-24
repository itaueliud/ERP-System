import React, { useState, FormEvent, useRef } from 'react';

export interface TwoFactorAuthProps {
  onSubmit: (code: string) => void | Promise<void>;
  onResend?: () => void;
  onBack?: () => void;
  isLoading?: boolean;
  error?: string;
  /** 'totp' | 'sms' | 'email' */
  method?: 'totp' | 'sms' | 'email';
}

export function TwoFactorAuth({ onSubmit, onResend, onBack, isLoading, error, method = 'totp' }: TwoFactorAuthProps) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(code.trim());
  };

  const methodLabel = method === 'totp' ? 'authenticator app' : method === 'sms' ? 'SMS' : 'email';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Two-Factor Authentication</h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          Enter the 6-digit code from your {methodLabel}.
        </p>
        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-6">
            <label htmlFor="tfa-code" className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <input
              id="tfa-code"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
              aria-label="6-digit verification code"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || code.length !== 6}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          {onResend && (
            <button onClick={onResend} className="text-blue-600 hover:underline">
              Resend code
            </button>
          )}
          {onBack && (
            <button onClick={onBack} className="text-gray-500 hover:underline">
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TwoFactorAuth;
