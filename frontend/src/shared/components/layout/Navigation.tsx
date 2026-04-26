import React from 'react';

export interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface NavigationProps {
  items: NavItem[];
  activeId?: string;
  orientation?: 'horizontal' | 'vertical';
  onItemClick?: (item: NavItem) => void;
  className?: string;
}

export function Navigation({ items, activeId, orientation = 'horizontal', onItemClick, className = '' }: NavigationProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <nav aria-label="Navigation" className={className}>
      <ul className={`flex ${isHorizontal ? 'flex-row gap-1' : 'flex-col gap-1'}`}>
        {items.map((item) => {
          const isActive = item.id === activeId;
          const Tag = item.href ? 'a' : 'button';
          return (
            <li key={item.id}>
              <Tag
                href={item.href}
                onClick={item.href ? undefined : () => onItemClick?.(item)}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={item.disabled}
                tabIndex={item.disabled ? -1 : 0}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                  ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}
                  ${item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
                  focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                {item.icon && <span className="w-4 h-4 flex-shrink-0" aria-hidden="true">{item.icon}</span>}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Tag>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default Navigation;
