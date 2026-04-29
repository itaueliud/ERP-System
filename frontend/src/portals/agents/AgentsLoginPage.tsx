import LoginTemplate from '../../shared/components/auth/LoginTemplate';

export default function AgentsLoginPage() {
  return (
    <LoginTemplate
      allowedRoles={['AGENT']}
      portalName="Agents Portal"
      portalDescription="Client capture, lead tracking, M-Pesa commitment payments and personal performance dashboard."
      primaryColor="#ea580c"
      sidebarColor="#431407"
      accentColor="#2563eb"
      features={[
        'Client capture 3-step wizard',
        'M-Pesa STK Push commitment payments',
        'Lead status real-time tracking',
        'TST PlotConnect property listings',
        'Personal performance metrics',
      ]}
      devCreds={[{ label: 'Agent', email: 'agent@tst.com', password: 'Agent@1234567!' }]}
    />
  );
}
