import React from 'react';

export interface ListItem {
  id: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export interface ListProps {
  items: ListItem[];
  emptyMessage?: string;
  divided?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function List({ items, emptyMessage = 'No items.', divided = true, className = '', 'aria-label': ariaLabel }: ListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">{emptyMessage}</p>;
  }

  return (
    <ul
      className={`${divided ? 'divide-y divide-gray-100' : ''} ${className}`}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const Tag = item.onClick ? 'button' : 'li';
        return (
          <li key={item.id}>
            <Tag
              onClick={item.onClick}
              disabled={item.onClick ? item.disabled : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left
                ${item.onClick ? 'hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500' : ''}
                ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {item.leading && <span className="flex-shrink-0">{item.leading}</span>}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-900 truncate">{item.primary}</span>
                {item.secondary && <span className="block text-xs text-gray-500 truncate">{item.secondary}</span>}
              </span>
              {item.trailing && <span className="flex-shrink-0 text-gray-400">{item.trailing}</span>}
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}

export default List;
