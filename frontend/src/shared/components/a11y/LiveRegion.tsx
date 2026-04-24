import React from 'react';

export interface LiveRegionProps {
  /** The message to announce to screen readers. */
  message: string;
  /** Politeness level. Default: 'polite' */
  politeness?: 'polite' | 'assertive';
  /** Optional className override */
  className?: string;
}

/**
 * ARIA live region component for screen reader announcements.
 * Renders a visually-hidden element that announces `message` changes.
 */
export function LiveRegion({ message, politeness = 'polite', className }: LiveRegionProps) {
  return (
    <div
      aria-live={politeness}
      aria-atomic="true"
      aria-relevant="additions text"
      className={
        className ??
        'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 [clip:rect(0,0,0,0)]'
      }
    >
      {message}
    </div>
  );
}

export default LiveRegion;
