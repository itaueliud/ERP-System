import React from 'react';

export interface SidebarItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ReactNode;
  children?: SidebarItem[];
  badge?: string | number;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeId?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  onItemClick?: (item: SidebarItem) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

function SidebarNavItem({
  item,
  activeId,
  collapsed,
  onItemClick,
  depth = 0,
}: {
  item: SidebarItem;
  activeId?: string;
  collapsed?: boolean;
  onItemClick?: (item: SidebarItem) => void;
  depth?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const isActive = item.id === activeId;
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = () => {
    if (hasChildren) setOpen((o) => !o);
    onItemClick?.(item);
  };

  return (
    <li>
      <button
        onClick={handleClick}
        aria-current={isActive ? 'page' : undefined}
        aria-expanded={hasChildren ? open : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
          ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}
          ${depth > 0 ? 'pl-8' : ''}`}
      >
        {item.icon && <span className="flex-shrink-0 w-5 h-5" aria-hidden="true">{item.icon}</span>}
        {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
        {!collapsed && item.badge !== undefined && (
          <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
        {!collapsed && hasChildren && (
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
      {!collapsed && hasChildren && open && (
        <ul className="mt-1 space-y-1">
          {item.children!.map((child) => (
            <SidebarNavItem key={child.id} item={child} activeId={activeId} collapsed={collapsed} onItemClick={onItemClick} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ items, activeId, collapsed, onToggle, onItemClick, header, footer }: SidebarProps) {
  return (
    <aside
      className={`flex flex-col bg-white border-r border-gray-200 h-full transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
      aria-label="Sidebar navigation"
    >
      {header && <div className="p-4 border-b border-gray-200">{header}</div>}
      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="self-end m-2 p-1.5 rounded text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {items.map((item) => (
            <SidebarNavItem key={item.id} item={item} activeId={activeId} collapsed={collapsed} onItemClick={onItemClick} />
          ))}
        </ul>
      </nav>
      {footer && <div className="p-4 border-t border-gray-200">{footer}</div>}
    </aside>
  );
}

export default Sidebar;
