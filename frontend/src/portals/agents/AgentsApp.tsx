import { AuthProvider } from '../../shared/components/auth/AuthContext';
import { BrowserRouter, Routes, Route } from '../../shared/utils/router';
import PortalGuard from '../../shared/components/auth/PortalGuard';
import AgentsPortal from './index';
import AgentsLoginPage from './AgentsLoginPage';

const ALLOWED_ROLES = ['AGENT'];

export default function AgentsApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AgentsLoginPage />} />
          <Route path="/*" element={
            <PortalGuard allowedRoles={ALLOWED_ROLES} portalName="Agents Portal">
              <AgentsPortal />
            </PortalGuard>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
