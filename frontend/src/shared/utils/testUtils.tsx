import React from 'react';

/** Wraps children for testing — no external providers needed. */
export function TestQueryWrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
