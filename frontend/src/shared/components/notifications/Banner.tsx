import React from 'react';

export interface BannerProps {
  message: React.ReactNode;
  /** 'default' | 'success' | 'error' | 'warning' | 'info' */
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<NonNullable<BannerProps['variant']>, string> = {
  default: 'bg-gray-800 text-white',
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-400 text-yellow-900',
  info: 'bg-blue-600 text-white',
};

export function Banner({ message, variant = 'default', dismissible, onDismiss, actions, icon, className = '' }: BannerProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role="banner"
      aria-live="polite"
      className={`w-full flex items-center justify-center gap-3 px-4 py-3 text-sm ${styles} ${className}`}
    >
      {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
      <span className="flex-1 text-center">{message}</span>
      {actions && <div className="flex gap-2 flex-shrink-0">{actions}</div>}
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="flex-shrink-0 opacity-80 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default Banner;
