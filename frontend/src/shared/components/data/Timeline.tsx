import React from 'react';

export interface TimelineEvent {
  id: string;
  title: string;
  description?: React.ReactNode;
  timestamp?: string;
  icon?: React.ReactNode;
  /** 'default' | 'success' | 'warning' | 'error' | 'info' */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

const dotVariant: Record<NonNullable<TimelineEvent['variant']>, string> = {
  default: 'bg-gray-400',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

export function Timeline({ events, className = '' }: TimelineProps) {
  return (
    <ol className={`relative ${className}`} aria-label="Timeline">
      {events.map((event, idx) => {
        const variant = event.variant ?? 'default';
        const isLast = idx === events.length - 1;
        return (
          <li key={event.id} className="relative pl-8 pb-6">
            {/* Vertical line */}
            {!isLast && (
              <span className="absolute left-3 top-4 bottom-0 w-0.5 bg-gray-200" aria-hidden="true" />
            )}
            {/* Dot / icon */}
            <span
              className={`absolute left-0 top-1 flex items-center justify-center w-6 h-6 rounded-full ${dotVariant[variant]} text-white`}
              aria-hidden="true"
            >
              {event.icon ?? null}
            </span>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-gray-900">{event.title}</span>
                {event.timestamp && (
                  <time className="text-xs text-gray-400">{event.timestamp}</time>
                )}
              </div>
              {event.description && (
                <div className="mt-1 text-sm text-gray-600">{event.description}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default Timeline;
