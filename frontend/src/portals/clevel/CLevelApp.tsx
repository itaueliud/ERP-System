import { AuthProvider } from '../../shared/components/auth/AuthContext';
import { BrowserRouter, Routes, Route } from '../../shared/utils/router';
import PortalGuard from '../../shared/components/auth/PortalGuard';
import CLevelPortal from './index';
import CLevelLoginPage from './CLevelLoginPage';

const ALLOWED_ROLES = ['COO', 'CTO'];

export default function CLevelApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<CLevelLoginPage />} />
          <Route path="/*" element={
            <PortalGuard allowedRoles={ALLOWED_ROLES} portalName="C-Level Portal">
              <CLevelPortal />
            </PortalGuard>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
