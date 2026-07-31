'use client';

import * as React from 'react';
import { RedirectToSignIn, SignedIn, SignedOut } from '@clerk/nextjs';
import { clerkEnabled } from '@/lib/env';

/**
 * Gates protected app routes. When Clerk is enabled, signed-out users are
 * redirected to the sign-in flow; signed-in users see the app. When bypass is
 * on (no Clerk), children render directly (the mock/bypass identity is used).
 *
 * `clerkEnabled` is a build-time constant, so the branch is stable across
 * renders — no rules-of-hooks violation from the conditional return.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  if (!clerkEnabled) return <>{children}</>;
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
