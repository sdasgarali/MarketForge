import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="bg-grid flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-6xl font-bold text-primary">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you’re looking for doesn’t exist or has moved.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
