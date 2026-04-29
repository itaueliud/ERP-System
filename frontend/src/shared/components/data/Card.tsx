import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** 'default' | 'outlined' | 'elevated' */
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-8' };
const variantMap = {
  default: 'bg-white border border-gray-200 rounded-lg',
  outlined: 'bg-transparent border border-gray-300 rounded-lg',
  elevated: 'bg-white rounded-lg shadow-md',
};

export function Card({ title, subtitle, footer, actions, children, className = '', variant = 'default', padding = 'md', ...rest }: CardProps) {
  return (
    <div className={`${variantMap[variant]} overflow-hidden ${className}`} {...rest}>
      {(title || actions) && (
        <div className={`flex items-start justify-between gap-4 ${paddingMap[padding]} ${children ? 'border-b border-gray-100 pb-3' : ''}`}>
          <div>
            {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      )}
      {children && <div className={paddingMap[padding]}>{children}</div>}
      {footer && (
        <div className={`${paddingMap[padding]} border-t border-gray-100 bg-gray-50`}>
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
