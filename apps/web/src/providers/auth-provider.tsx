'use client';

import * as React from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { clerkEnabled, env } from '@/lib/env';

/**
 * Auth gate. When DEV_AUTH_BYPASS is on (or no Clerk key is present) we render
 * children directly — the app runs with the mock/bypass identity. Otherwise we
 * mount ClerkProvider so real sessions and org membership drive auth.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!clerkEnabled) {
    return <>{children}</>;
  }
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey}>
      {children}
    </ClerkProvider>
  );
}
