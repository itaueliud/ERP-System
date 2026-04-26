import React from 'react';

export interface ActivityItem {
  id: string;
  actor: string;
  actorAvatarUrl?: string;
  action: string;
  target?: string;
  timestamp: string;
  meta?: React.ReactNode;
}

export interface ActivityFeedProps {
  items: ActivityItem[];
  emptyMessage?: string;
  className?: string;
  maxItems?: number;
}

export function ActivityFeed({ items, emptyMessage = 'No activity yet.', className = '', maxItems }: ActivityFeedProps) {
  const displayed = maxItems ? items.slice(0, maxItems) : items;

  if (displayed.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">{emptyMessage}</p>;
  }

  return (
    <ul className={`space-y-4 ${className}`} aria-label="Activity feed">
      {displayed.map((item) => (
        <li key={item.id} className="flex gap-3">
          {item.actorAvatarUrl ? (
            <img
              src={item.actorAvatarUrl}
              alt={item.actor}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <span
              className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium flex-shrink-0"
              aria-hidden="true"
            >
              {item.actor.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">
              <span className="font-medium">{item.actor}</span>{' '}
              <span>{item.action}</span>
              {item.target && <span className="font-medium"> {item.target}</span>}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <time className="text-xs text-gray-400">{item.timestamp}</time>
              {item.meta && <span className="text-xs text-gray-500">{item.meta}</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default ActivityFeed;
