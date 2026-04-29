import { AuthProvider } from '../../shared/components/auth/AuthContext';
import { BrowserRouter, Routes, Route } from '../../shared/utils/router';
import PortalGuard from '../../shared/components/auth/PortalGuard';
import { RealtimeProvider } from '../../shared/utils/RealtimeContext';
import CEOPortal from './index';
import CEOLoginPage from './CEOLoginPage';

const ALLOWED_ROLES = ['CEO'];

export default function CEOApp() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<CEOLoginPage />} />
            <Route path="/*" element={
              <PortalGuard allowedRoles={ALLOWED_ROLES} portalName="CEO Portal">
                <CEOPortal />
              </PortalGuard>
            } />
          </Routes>
        </BrowserRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
