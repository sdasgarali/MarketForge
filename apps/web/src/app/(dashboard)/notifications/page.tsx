'use client';

import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Stagger, StaggerItem } from '@/components/common/motion';
import { useNotifications } from '@/lib/hooks';
import { notificationTypeMeta } from '@/lib/display';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { data, isLoading, isError, refetch } = useNotifications();
  const items = data?.data.items ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Approvals, publishes, failures, and system events."
        actions={<MockBadge show={data?.isMock} />}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="All caught up"
          description="You have no notifications right now."
        />
      ) : (
        <Stagger className="space-y-2.5">
          {items.map((n) => {
            const meta = notificationTypeMeta[n.type];
            return (
              <StaggerItem key={n.id}>
                <Card
                  className={cn(
                    'transition-colors',
                    !n.read_at && 'border-primary/30 bg-primary/[0.03]',
                  )}
                >
                  <CardContent className="flex items-start gap-3 py-4">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        meta.dot,
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{n.title}</p>
                        {!n.read_at ? (
                          <Badge variant={meta.variant} className="px-1.5 py-0">
                            New
                          </Badge>
                        ) : null}
                      </div>
                      {n.body ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {n.body}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Badge variant="muted" className="shrink-0 capitalize">
                      {n.type.replace('_', ' ')}
                    </Badge>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
