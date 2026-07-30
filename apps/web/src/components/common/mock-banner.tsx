import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Shown when a query fell back to local mock data (API unreachable). Makes the
 * dev affordance obvious so demo data is never mistaken for live data.
 */
export function MockBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <Badge variant="warning" className="gap-1">
      <FlaskConical className="h-3 w-3" />
      Demo data
    </Badge>
  );
}
