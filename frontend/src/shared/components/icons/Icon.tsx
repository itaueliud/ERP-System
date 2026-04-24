import React from 'react';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps {
  /** Accessible label for standalone icons */
  'aria-label'?: string;
  /** Set true when icon is decorative alongside visible text */
  'aria-hidden'?: boolean | 'true' | 'false';
  /** Size: sm=16px, md=20px, lg=24px, xl=32px */
  size?: IconSize;
  /** Additional Tailwind classes */
  className?: string;
  /** SVG path content rendered by each icon */
  children?: React.ReactNode;
  /** viewBox override (default "0 0 24 24") */
  viewBox?: string;
}

const SIZE_MAP: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export const Icon: React.FC<IconProps> = ({
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  size = 'md',
  className = '',
  children,
  viewBox = '0 0 24 24',
}) => {
  const px = SIZE_MAP[size];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={px}
      height={px}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      role={ariaLabel ? 'img' : undefined}
      className={className}
    >
      {children}
    </svg>
  );
};
