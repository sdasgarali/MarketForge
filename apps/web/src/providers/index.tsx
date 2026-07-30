'use client';

import * as React from 'react';
import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      richColors
      position="top-right"
      closeButton
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <QueryProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <ThemedToaster />
          </TooltipProvider>
        </QueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
