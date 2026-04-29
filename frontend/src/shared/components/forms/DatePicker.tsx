import { InputHTMLAttributes, forwardRef } from 'react';

export interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
  /** 'date' | 'datetime-local' | 'time' | 'month' | 'week' */
  inputType?: 'date' | 'datetime-local' | 'time' | 'month' | 'week';
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, hint, wrapperClassName = '', id, className = '', inputType = 'date', ...rest }, ref) => {
    const inputId = id ?? `datepicker-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className={`flex flex-col gap-1 ${wrapperClassName}`}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={inputType}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? 'true' : undefined}
          className={`px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}
            disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
          {...rest}
        />
        {hint && !error && <p id={hintId} className="text-xs text-gray-500">{hint}</p>}
        {error && <p id={errorId} role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';
export default DatePicker;
