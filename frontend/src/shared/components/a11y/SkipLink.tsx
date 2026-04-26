import React from 'react';

export interface SkipLinkProps {
  /** The id of the main content element to skip to. Default: 'main-content' */
  targetId?: string;
  /** Link text. Default: 'Skip to main content' */
  label?: string;
}

/**
 * "Skip to main content" link that is visually hidden until focused.
 * Should be rendered as the first element in the page.
 */
export function SkipLink({ targetId = 'main-content', label = 'Skip to main content' }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={[
        'absolute left-2 top-2 z-[9999]',
        'px-4 py-2 rounded bg-blue-700 text-white text-sm font-medium',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        // Visually hidden until focused
        'translate-y-[-200%] focus:translate-y-0',
        'transition-transform duration-150',
      ].join(' ')}
    >
      {label}
    </a>
  );
}

export default SkipLink;
