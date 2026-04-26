import React from 'react';

export interface AlertProps {
  title?: string;
  message: React.ReactNode;
  /** 'success' | 'error' | 'warning' | 'info' */
  variant?: 'success' | 'error' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<NonNullable<AlertProps['variant']>, { wrapper: string; icon: string; title: string; text: string }> = {
  success: { wrapper: 'bg-green-50 border-green-300', icon: 'text-green-500', title: 'text-green-800', text: 'text-green-700' },
  error: { wrapper: 'bg-red-50 border-red-300', icon: 'text-red-500', title: 'text-red-800', text: 'text-red-700' },
  warning: { wrapper: 'bg-yellow-50 border-yellow-300', icon: 'text-yellow-500', title: 'text-yellow-800', text: 'text-yellow-700' },
  info: { wrapper: 'bg-blue-50 border-blue-300', icon: 'text-blue-500', title: 'text-blue-800', text: 'text-blue-700' },
};

const icons: Record<NonNullable<AlertProps['variant']>, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function Alert({ title, message, variant = 'info', dismissible, onDismiss, actions, className = '' }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      role="alert"
      className={`flex gap-3 p-4 border rounded-lg ${styles.wrapper} ${className}`}
    >
      <span className={`text-lg font-bold flex-shrink-0 mt-0.5 ${styles.icon}`} aria-hidden="true">
        {icons[variant]}
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className={`text-sm font-semibold ${styles.title}`}>{title}</p>}
        <div className={`text-sm ${styles.text} ${title ? 'mt-1' : ''}`}>{message}</div>
        {actions && <div className="mt-3 flex gap-2">{actions}</div>}
      </div>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className={`flex-shrink-0 ${styles.icon} hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default Alert;
