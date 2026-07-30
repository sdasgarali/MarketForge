'use client';

import { AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/page-header';
import { MockBadge } from '@/components/common/mock-banner';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ApprovalCard } from '@/components/approvals/approval-card';
import {
  useApprovals,
  useApprove,
  useRegenerateContent,
  useReject,
} from '@/lib/hooks';

export default function ApprovalsPage() {
  const { data, isLoading, isError, refetch } = useApprovals();
  const approve = useApprove();
  const reject = useReject();
  const regenerate = useRegenerateContent();

  const items = data?.data.items ?? [];
  const busy = approve.isPending || reject.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval queue"
        description="Review AI-scored content and decide what ships. Trusted brands auto-schedule on approval."
        actions={
          <>
            <MockBadge show={data?.isMock} />
            {items.length > 0 ? (
              <span className="text-sm text-muted-foreground">
                {items.length} awaiting review
              </span>
            ) : null}
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6" />}
          title="Inbox zero"
          description="Nothing is waiting for approval right now. New content lands here after AI review."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {items.map((a) => (
              <ApprovalCard
                key={a.content_item.id}
                approval={a}
                busy={busy}
                onApprove={() => approve.mutate(a.content_item.id)}
                onReject={() => reject.mutate(a.content_item.id)}
                onRegenerate={() => regenerate.mutate(a.content_item.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
