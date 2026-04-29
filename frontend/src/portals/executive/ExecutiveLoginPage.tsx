import LoginTemplate from '../../shared/components/auth/LoginTemplate';

export default function ExecutiveLoginPage() {
  return (
    <LoginTemplate
      allowedRoles={['CFO', 'CoS', 'EA', 'CFO_ASSISTANT']}
      portalName="Executive Portal"
      portalDescription="Financial oversight, payment approvals, compliance management and cross-department coordination."
      primaryColor="#0f766e"
      sidebarColor="#1e293b"
      accentColor="#0f766e"
      features={[
        'Revenue collection across all platforms',
        'Payment approval and execution pipeline',
        'Tax & compliance management',
        'Service amount configuration',
        'Anti-corruption audit controls',
      ]}
      devCreds={[
        { label: 'CFO', email: 'cfo@tst.com', password: 'Cfo@123456789!' },
        { label: 'CoS', email: 'cos@tst.com', password: 'Cos@123456789!' },
        { label: 'EA',  email: 'ea@tst.com',  password: 'Ea@1234567890!' },
      ]}
    />
  );
}
