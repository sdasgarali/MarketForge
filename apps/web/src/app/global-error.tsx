'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100dvh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontFamily: 'system-ui, sans-serif',
          background: '#0d0d10',
          color: '#e5e5e5',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: '#7c6cf0',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
