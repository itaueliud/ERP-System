import LoginTemplate from '../../shared/components/auth/LoginTemplate';

export default function CLevelLoginPage() {
  return (
    <LoginTemplate
      allowedRoles={['COO', 'CTO']}
      portalName="C-Level Portal"
      portalDescription="Department management, strategic planning, GitHub integration and cross-country performance analytics."
      primaryColor="#15803d"
      sidebarColor="#052e16"
      accentColor="#f59e0b"
      features={[
        'Department KPI tracking',
        'Cross-country achievements overview',
        'GitHub integration and developer metrics',
        'Budget and expense management',
        'Tech funding requests',
      ]}
      devCreds={[
        { label: 'COO', email: 'coo@tst.com', password: 'Coo@123456789!' },
        { label: 'CTO', email: 'cto@tst.com', password: 'Cto@123456789!' },
      ]}
    />
  );
}
