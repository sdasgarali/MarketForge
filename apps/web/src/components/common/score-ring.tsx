import { cn } from '@/lib/utils';
import { scoreTone } from '@/lib/display';

/** Compact circular gauge for a 0–100 composite AI score. */
export function ScoreRing({
  score,
  size = 56,
  label = 'AI score',
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const tone = scoreTone(score);
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={cn('transition-all duration-700', tone.text)}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={cn(
          'absolute text-sm font-semibold tabular-nums',
          tone.text,
        )}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

/** Thin horizontal score bar for per-check breakdowns. */
export function ScoreBar({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const tone = scoreTone(score);
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-all', tone.bar)}
        style={{ width: `${Math.max(4, score)}%` }}
      />
    </div>
  );
}
