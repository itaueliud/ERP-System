import { useEffect } from 'react';

export interface ToastProps {
  id: string;
  message: string;
  title?: string;
  /** 'success' | 'error' | 'warning' | 'info' */
  variant?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onDismiss: (id: string) => void;
}

const variantStyles: Record<NonNullable<ToastProps['variant']>, { wrapper: string; icon: string }> = {
  success: { wrapper: 'border-green-400 bg-green-50', icon: 'text-green-500' },
  error: { wrapper: 'border-red-400 bg-red-50', icon: 'text-red-500' },
  warning: { wrapper: 'border-yellow-400 bg-yellow-50', icon: 'text-yellow-500' },
  info: { wrapper: 'border-blue-400 bg-blue-50', icon: 'text-blue-500' },
};

const icons: Record<NonNullable<ToastProps['variant']>, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function Toast({ id, message, title, variant = 'info', duration = 4000, onDismiss }: ToastProps) {
  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const styles = variantStyles[variant];

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`flex items-start gap-3 w-80 max-w-full p-4 border rounded-lg shadow-lg ${styles.wrapper}`}
    >
      <span className={`text-lg font-bold flex-shrink-0 ${styles.icon}`} aria-hidden="true">
        {icons[variant]}
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-gray-900">{title}</p>}
        <p className="text-sm text-gray-700">{message}</p>
      </div>
      <button
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** Container that stacks toasts in the corner */
export interface ToastContainerProps {
  toasts: Omit<ToastProps, 'onDismiss'>[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const positionMap = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

export function ToastContainer({ toasts, onDismiss, position = 'top-right' }: ToastContainerProps) {
  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 ${positionMap[position]}`}
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default Toast;
