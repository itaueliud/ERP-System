import React, { useEffect, useState } from 'react';

interface SandboxStatus {
  sandbox: boolean;
  apiUrl: string;
  shortCode: string;
  testPhone: string | null;
  credentialsConfigured: boolean;
  message: string;
  docsUrl: string | null;
}

/**
 * SandboxBanner — shows a prominent warning when the payment gateway is in sandbox mode.
 * Fetches status from GET /api/payments/sandbox/status.
 * Renders nothing in production mode.
 */
export function SandboxBanner() {
  const [status, setStatus] = useState<SandboxStatus | null>(null);

  useEffect(() => {
    import('../../api/apiClient').then(({ apiClient }) => {
      apiClient.get('/api/v1/payments/sandbox/status')
        .then(res => setStatus(res.data))
        .catch(() => { /* silent — don't break UI if endpoint unreachable */ });
    });
  }, []);

  if (!status?.sandbox) return null;

  return (
    <div
      role="alert"
      aria-label="Sandbox payment mode active"
      style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '1.5px solid #f59e0b',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      {/* Warning icon */}
      <svg style={{ width: 20, height: 20, color: '#b45309', flexShrink: 0, marginTop: 1 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>

      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
          SANDBOX MODE — No real money is processed
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#78350f' }}>
          {status.message}
        </p>
        {!status.credentialsConfigured && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350f' }}>
            No API credentials configured — transactions are fully simulated locally.
            {status.docsUrl && (
              <> Get free sandbox credentials at{' '}
                <a href={status.docsUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#b45309', textDecoration: 'underline' }}>
                  developer.safaricom.co.ke
                </a>.
              </>
            )}
          </p>
        )}
        <div style={{ marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#92400e' }}>
            Short code: <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 4 }}>{status.shortCode}</code>
          </span>
          {status.testPhone && (
            <span style={{ fontSize: 11, color: '#92400e' }}>
              Test phone: <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 4 }}>{status.testPhone}</code>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
