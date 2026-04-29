import LoginTemplate from '../../shared/components/auth/LoginTemplate';

export default function TechnologyLoginPage() {
  return (
    <LoginTemplate
      allowedRoles={['TECH_STAFF', 'DEVELOPER']}
      portalName="Technology Portal"
      portalDescription="Software development, infrastructure security, GitHub integration and engineering operations delivery."
      primaryColor="#4338ca"
      sidebarColor="#1e1b4b"
      accentColor="#06b6d4"
      features={[
        'Project and sprint management',
        'GitHub repository and commit tracking',
        'Infrastructure security monitoring',
        'Contract download and signing',
        'Team performance metrics',
      ]}
      devCreds={[
        { label: 'Security Manager',        email: 'tech@tst.com',     password: 'Tech@12345678!' },
        { label: 'Lead Software Architect', email: 'softeng@tst.com',  password: 'Tech@12345678!' },
        { label: 'Developer (Team Leader)', email: 'dev@tst.com',      password: 'Dev@123456789!' },
      ]}
    />
  );
}
