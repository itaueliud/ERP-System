import { AuthProvider } from '../../shared/components/auth/AuthContext';
import { BrowserRouter, Routes, Route } from '../../shared/utils/router';
import PortalGuard from '../../shared/components/auth/PortalGuard';
import { RealtimeProvider } from '../../shared/utils/RealtimeContext';
import OperationsPortal from './index';
import OperationsLoginPage from './OperationsLoginPage';

const ALLOWED_ROLES = ['OPERATIONS_USER', 'HEAD_OF_TRAINERS', 'TRAINER', 'COO'];

export default function OperationsApp() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<OperationsLoginPage />} />
            <Route path="/*" element={
              <PortalGuard allowedRoles={ALLOWED_ROLES} portalName="Operations Portal">
                <OperationsPortal />
              </PortalGuard>
            } />
          </Routes>
        </BrowserRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
