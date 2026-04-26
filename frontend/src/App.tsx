import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from './shared/utils/router';
import { useAuth, getPortalForRole } from './shared/components/auth/AuthContext';
import PortalHome from './pages/PortalHome';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Lazy-load portals — each is a separate chunk
const CEOPortal        = lazy(() => import('./portals/ceo'));
const ExecutivePortal  = lazy(() => import('./portals/executive'));
const CLevelPortal     = lazy(() => import('./portals/clevel'));
const OperationsPortal = lazy(() => import('./portals/operations'));
const TechnologyPortal = lazy(() => import('./portals/technology'));
const AgentsPortal     = lazy(() => import('./portals/agents'));
const TrainersPortal   = lazy(() => import('./portals/trainers'));

// Allowed roles per portal path
const PORTAL_ROLES: Record<string, string[]> = {
  '/ceo':        ['CEO'],
  '/executive':  ['CFO', 'CoS', 'EA'],
  '/clevel':     ['COO', 'CTO'],
  '/operations': ['OPERATIONS_USER', 'COO'],
  '/technology': ['TECH_STAFF', 'DEVELOPER', 'CTO'],
  '/agents':     ['AGENT'],
  '/trainers':   ['HEAD_OF_TRAINERS', 'TRAINER'],
};

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm font-medium">Loading portal…</p>
      </div>
    </div>
  );
}

/**
 * Guards a portal route:
 * - Not authenticated → redirect to /login (with return path)
 * - Wrong role → redirect to their correct portal
 * - Correct role → render children
 */
function PortalGuard({ portalPath, children }: { portalPath: string; children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user's role is allowed for this portal
  const allowedRoles = PORTAL_ROLES[portalPath] ?? [];
  const userRole = user?.role ?? '';

  if (!allowedRoles.includes(userRole)) {
    // Redirect to their correct portal
    const correctPortal = getPortalForRole(userRole);
    if (correctPortal !== portalPath) {
      return <Navigate to={correctPortal} replace />;
    }
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<PortalHome />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/ceo" element={
            <PortalGuard portalPath="/ceo"><CEOPortal /></PortalGuard>
          } />
          <Route path="/executive" element={
            <PortalGuard portalPath="/executive"><ExecutivePortal /></PortalGuard>
          } />
          <Route path="/clevel" element={
            <PortalGuard portalPath="/clevel"><CLevelPortal /></PortalGuard>
          } />
          <Route path="/operations" element={
            <PortalGuard portalPath="/operations"><OperationsPortal /></PortalGuard>
          } />
          <Route path="/technology" element={
            <PortalGuard portalPath="/technology"><TechnologyPortal /></PortalGuard>
          } />
          <Route path="/agents" element={
            <PortalGuard portalPath="/agents"><AgentsPortal /></PortalGuard>
          } />
          <Route path="/trainers" element={
            <PortalGuard portalPath="/trainers"><TrainersPortal /></PortalGuard>
          } />

          {/* Catch-all → home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
