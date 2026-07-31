import { SignIn } from '@clerk/nextjs';

/**
 * Clerk sign-in page (catch-all so Clerk can render its sub-routes:
 * verification, factor-two, SSO callback, etc.). Reached when an
 * unauthenticated user hits a protected route (see AuthGate).
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
