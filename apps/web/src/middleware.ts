import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Clerk v6 expects `clerkMiddleware()` to run for Clerk to work end-to-end
 * (session context, <SignIn> flows, useAuth). In bypass mode (no publishable
 * key, or NEXT_PUBLIC_DEV_AUTH_BYPASS=1) we pass through untouched so local/dev
 * builds run without any Clerk config. Route protection itself is done in the
 * client <AuthGate>; this middleware only wires Clerk's request context.
 */
const clerkOn =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS !== '1';

export default clerkOn ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Run on all routes except Next internals and static assets.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp|woff2?|ttf|map)).*)',
    '/(api|trpc)(.*)',
  ],
};
