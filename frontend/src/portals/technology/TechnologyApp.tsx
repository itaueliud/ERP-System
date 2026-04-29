import { AuthProvider } from '../../shared/components/auth/AuthContext';
import { BrowserRouter, Routes, Route } from '../../shared/utils/router';
import PortalGuard from '../../shared/components/auth/PortalGuard';
import { RealtimeProvider } from '../../shared/utils/RealtimeContext';
import TechnologyPortal from './index';
import TechnologyLoginPage from './TechnologyLoginPage';

const ALLOWED_ROLES = ['TECH_STAFF', 'DEVELOPER'];

export default function TechnologyApp() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<TechnologyLoginPage />} />
            <Route path="/*" element={
              <PortalGuard allowedRoles={ALLOWED_ROLES} portalName="Technology Portal">
                <TechnologyPortal />
              </PortalGuard>
            } />
          </Routes>
        </BrowserRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
