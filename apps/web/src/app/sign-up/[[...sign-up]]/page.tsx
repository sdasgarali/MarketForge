import { SignUp } from '@clerk/nextjs';

/** Clerk sign-up page (catch-all — mirrors the sign-in route). */
export default function SignUpPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
