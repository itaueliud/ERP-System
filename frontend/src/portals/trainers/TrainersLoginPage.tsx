import LoginTemplate from '../../shared/components/auth/LoginTemplate';

export default function TrainersLoginPage() {
  return (
    <LoginTemplate
      allowedRoles={['HEAD_OF_TRAINERS', 'TRAINER']}
      portalName="Trainers Portal"
      portalDescription="Agent management, client conversion tracking, training coordination and daily performance reporting."
      primaryColor="#7c3aed"
      sidebarColor="#2e1065"
      accentColor="#22c55e"
      features={[
        'Agent assignment and reassignment',
        'Client conversion pipeline',
        'Trainer performance by country',
        'Priority listing modification',
        'CFO direct communication',
      ]}
      devCreds={[
        { label: 'Head Trainer', email: 'headtrainer@tst.com', password: 'Head@12345678!' },
        { label: 'Trainer',      email: 'trainer@tst.com',     password: 'Train@1234567!' },
      ]}
    />
  );
}
