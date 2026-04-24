import React from 'react';

export interface HeaderUser {
  name: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
}

export interface HeaderProps {
  user?: HeaderUser;
  title?: string;
  onMenuToggle?: () => void;
  onLogout?: () => void;
  onProfileClick?: () => void;
  children?: React.ReactNode;
}

export function Header({ user, title = 'TechSwiftTrix ERP', onMenuToggle, onLogout, onProfileClick, children }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 gap-4 z-30 sticky top-0">
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          aria-label="Toggle sidebar"
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      <span className="text-lg font-semibold text-gray-800 flex-1">{title}</span>
      {children}
      {user && (
        <div className="flex items-center gap-3">
          <button
            onClick={onProfileClick}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
            aria-label="User profile"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden sm:block font-medium">{user.name}</span>
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-sm text-gray-500 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              aria-label="Sign out"
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;
