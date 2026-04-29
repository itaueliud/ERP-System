import React from 'react';
import { Navigate } from '../../utils/router';
import { useAuth } from './AuthContext';
import AccessDenied from './AccessDenied';

interface PortalGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  portalName?: string;
}

export default function PortalGuard({ children, allowedRoles, portalName = 'Portal' }: PortalGuardProps) {
  const { isLoading, isAuthenticated, user, logout } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!user || !allowedRoles.includes(user.role)) {
    return <AccessDenied logout={logout} allowedRoles={allowedRoles} portalName={portalName} />;
  }

  // Chat is now embedded inside PortalLayout as a side panel.
  // PortalLayout receives token/currentUserId/portalName from each portal's index.tsx.
  return <>{children}</>;
}
