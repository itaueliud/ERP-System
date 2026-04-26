import { useNavigate } from '../../utils/router';

interface AccessDeniedProps {
  logout: () => void;
  allowedRoles: string[];
  portalName: string;
}

export default function AccessDenied({ logout, allowedRoles, portalName }: AccessDeniedProps) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f9fafb',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 8,
          padding: '2rem',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>
          Access Denied
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          The <strong>{portalName}</strong> is restricted to:
        </p>
        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
          {allowedRoles.map((role) => (
            <li
              key={role}
              style={{
                display: 'inline-block',
                margin: '0.25rem',
                padding: '0.25rem 0.75rem',
                backgroundColor: '#f3f4f6',
                borderRadius: 9999,
                fontSize: '0.875rem',
                color: '#374151',
              }}
            >
              {role}
            </li>
          ))}
        </ul>
        <button
          onClick={handleSignOut}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
