import LoginTemplate from '../../shared/components/auth/LoginTemplate';

export default function CEOLoginPage() {
  return (
    <LoginTemplate
      allowedRoles={['CEO']}
      portalName="CEO Portal"
      portalDescription="Full system visibility — revenue, approvals, audit logs, people management and strategic oversight across all 54 African countries."
      primaryColor="#1d4ed8"
      sidebarColor="#0f2557"
      accentColor="#f59e0b"
      features={[
        'Real-time P&L and revenue dashboards',
        'Payment and pricing approvals queue',
        'Full audit log and session control',
        'Cross-country performance analytics',
        'System admin — user & role management',
      ]}
      devCreds={[{ label: 'CEO', email: 'ceo@tst.com', password: 'Ceo@123456789!' }]}
    />
  );
}
