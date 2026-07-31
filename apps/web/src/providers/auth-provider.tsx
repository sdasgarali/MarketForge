'use client';

import * as React from 'react';

/**
 * Auth is token-based (localStorage) and read directly by the api-client, so
 * there's no context provider to mount. Kept as a passthrough to preserve the
 * provider tree shape (see providers/index).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
