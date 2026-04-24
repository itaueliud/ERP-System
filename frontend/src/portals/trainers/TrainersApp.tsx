import { AuthProvider } from '../../shared/components/auth/AuthContext';
import { BrowserRouter, Routes, Route } from '../../shared/utils/router';
import PortalGuard from '../../shared/components/auth/PortalGuard';
import TrainersPortal from './index';
import TrainersLoginPage from './TrainersLoginPage';

const ALLOWED_ROLES = ['HEAD_OF_TRAINERS', 'TRAINER'];

export default function TrainersApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<TrainersLoginPage />} />
          <Route path="/*" element={
            <PortalGuard allowedRoles={ALLOWED_ROLES} portalName="Trainers Portal">
              <TrainersPortal />
            </PortalGuard>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
