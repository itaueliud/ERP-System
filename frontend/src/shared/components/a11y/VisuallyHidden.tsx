import React from 'react';

export interface VisuallyHiddenProps {
  children: React.ReactNode;
  /** Render as a different element. Default: 'span' */
  as?: React.ElementType;
}

/**
 * Hides content visually but keeps it accessible to screen readers (sr-only pattern).
 */
export function VisuallyHidden({ children, as: Tag = 'span' }: VisuallyHiddenProps) {
  return (
    <Tag className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]">
      {children}
    </Tag>
  );
}

export default VisuallyHidden;
