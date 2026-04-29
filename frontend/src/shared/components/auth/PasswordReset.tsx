import { useState, FormEvent } from 'react';

export interface PasswordResetProps {
  onSubmit: (email: string) => void | Promise<void>;
  onBack?: () => void;
  isLoading?: boolean;
  error?: string;
  success?: boolean;
}

export function PasswordReset({ onSubmit, onBack, isLoading, error, success }: PasswordResetProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(email);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Reset Password</h1>
        <p className="text-gray-500 text-sm text-center mb-6">
          Enter your email and we'll send you a reset link.
        </p>
        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}
        {success ? (
          <div role="status" className="p-4 bg-green-50 border border-green-200 text-green-700 rounded text-center">
            Check your email for a reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-6">
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}
        {onBack && (
          <button onClick={onBack} className="mt-4 w-full text-center text-sm text-blue-600 hover:underline">
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}

export default PasswordReset;
