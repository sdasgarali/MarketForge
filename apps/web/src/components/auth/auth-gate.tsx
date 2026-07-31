'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

/**
 * Client-side route guard for the manual JWT flow. If there's no token in
 * localStorage, redirect to /sign-in; otherwise render the app. Renders nothing
 * until the check runs (avoids a flash of the dashboard before redirect).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = React.useState(false);

  React.useEffect(() => {
    if (isAuthenticated()) {
      setOk(true);
    } else {
      router.replace('/sign-in');
    }
  }, [router]);

  if (!ok) return null;
  return <>{children}</>;
}
