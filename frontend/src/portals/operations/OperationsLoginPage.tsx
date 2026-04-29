import LoginTemplate from '../../shared/components/auth/LoginTemplate';

export default function OperationsLoginPage() {
  return (
    <LoginTemplate
      allowedRoles={['OPERATIONS_USER','HEAD_OF_TRAINERS','TRAINER','SALES_MANAGER','CLIENT_SUCCESS_USER','ACCOUNT_EXECUTIVE','SENIOR_ACCOUNT_MANAGER','MARKETING_USER','MARKETING_OFFICER']}
      portalName="Operations Portal"
      portalDescription="Sales, client acquisition, client success management, marketing operations and trainer coordination."
      primaryColor="#0f766e"
      sidebarColor="#042f2e"
      accentColor="#f97316"
      features={[
        'Client acquisition and lead management',
        'Client success and account management',
        'Marketing campaign tracking',
        'Trainer and agent performance',
        'Daily report submission',
      ]}
      devCreds={[
        { label: 'Operations', email: 'ops@tst.com',         password: 'Ops@123456789!' },
        { label: 'Head Trainer', email: 'headtrainer@tst.com', password: 'Head@12345678!' },
        { label: 'Trainer',    email: 'trainer@tst.com',     password: 'Train@1234567!' },
      ]}
    />
  );
}
