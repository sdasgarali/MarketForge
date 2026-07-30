import { cn } from '@/lib/utils';
import { platformMeta } from '@/lib/display';
import type { Platform } from '@/lib/types';

export function PlatformIcon({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  const meta = platformMeta[platform];
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold',
        meta.className,
        className,
      )}
      title={meta.label}
      aria-label={meta.label}
    >
      {meta.short}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  const meta = platformMeta[platform];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <PlatformIcon platform={platform} />
      <span className="text-muted-foreground">{meta.label}</span>
    </span>
  );
}
