'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Play,
  Power,
  RotateCcw,
} from 'lucide-react';
import {
  type StepStatus,
  type StepView,
  usePipelines,
  useResumePipelines,
  useShutdownPipelines,
  useStartPipelines,
} from '@/lib/hooks/pipelines';
import { PageHeader } from '@/components/common/page-header';
import { FadeIn } from '@/components/common/motion';
import { StepConfigDialog } from '@/components/pipelines/step-config-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const STATUS_STYLES: Record<StepStatus, { dot: string; ring: string; label: string }> = {
  idle: { dot: 'bg-muted-foreground/40', ring: 'border-border', label: 'Idle' },
  queued: { dot: 'bg-amber-500', ring: 'border-amber-500/40', label: 'Queued' },
  running: { dot: 'bg-blue-500 animate-pulse', ring: 'border-blue-500/60', label: 'Running' },
  error: { dot: 'bg-destructive', ring: 'border-destructive/50', label: 'Error' },
  stopped: { dot: 'bg-destructive', ring: 'border-destructive/60', label: 'Stopped' },
};

function StepNode({
  step,
  onSelect,
}: {
  step: StepView;
  onSelect: (s: StepView) => void;
}) {
  const s = STATUS_STYLES[step.status];
  const active = step.counts?.active ?? 0;
  const waiting = (step.counts?.waiting ?? 0) + (step.counts?.delayed ?? 0);
  const failed = step.counts?.failed ?? 0;
  const configurable = step.provider_options.length > 0;
  const selected = step.provider_options.find((o) => o.id === step.selected_provider);

  return (
    <button
      type="button"
      disabled={!configurable}
      onClick={() => configurable && onSelect(step)}
      className={`min-w-[150px] max-w-[190px] shrink-0 rounded-lg border bg-card p-3 text-left transition ${s.ring} ${
        step.decision ? 'border-dashed' : ''
      } ${configurable ? 'cursor-pointer hover:border-primary/60 hover:shadow-sm' : 'cursor-default'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {step.decision ? 'Decision' : s.label}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug">{step.label}</p>
      {step.note ? (
        <p className="mt-1 text-xs text-muted-foreground">{step.note}</p>
      ) : null}
      {step.queue ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {active > 0 ? <Badge variant="secondary">{active} active</Badge> : null}
          {waiting > 0 ? <Badge variant="outline">{waiting} queued</Badge> : null}
          {failed > 0 ? <Badge variant="destructive">{failed} failed</Badge> : null}
          <span className="font-mono text-[10px] text-muted-foreground">{step.queue}</span>
        </div>
      ) : null}
      {configurable ? (
        <div className="mt-2 border-t border-border pt-2">
          {selected ? (
            <Badge variant="secondary" className="text-[10px]">
              AI: {selected.name}
            </Badge>
          ) : (
            <span className="text-[10px] text-primary">Click to choose AI + key</span>
          )}
        </div>
      ) : null}
    </button>
  );
}

export default function PipelinesPage() {
  const { data, isLoading } = usePipelines();
  const start = useStartPipelines();
  const shutdown = useShutdownPipelines();
  const resume = useResumePipelines();

  const [activeStep, setActiveStep] = React.useState<StepView | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  function openStep(step: StepView) {
    setActiveStep(step);
    setDialogOpen(true);
  }

  const killed = data?.kill_switch.engaged ?? false;
  const busy = start.isPending || shutdown.isPending || resume.isPending;

  function onShutdown() {
    if (
      window.confirm(
        'FORCE SHUTDOWN: pause and obliterate every queue and abort all running jobs. Continue?',
      )
    ) {
      shutdown.mutate();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipelines monitor"
        description="Live view of the automation pipelines. Start the orchestrator or force-stop everything."
      />

      {/* Control bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => start.mutate()} disabled={busy}>
          {start.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Auto — start
        </Button>

        <Button variant="destructive" onClick={onShutdown} disabled={busy}>
          {shutdown.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          Force shutdown
        </Button>

        {killed ? (
          <Button variant="outline" onClick={() => resume.mutate()} disabled={busy}>
            {resume.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Re-enable
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2 text-sm">
          <Badge variant="secondary">{data?.totals.active ?? 0} active</Badge>
          <Badge variant="outline">{data?.totals.waiting ?? 0} queued</Badge>
          <Badge variant="destructive">{data?.totals.failed ?? 0} failed</Badge>
          <Badge variant="muted">{data?.totals.completed ?? 0} done</Badge>
        </div>
      </div>

      {killed ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">
              Kill switch engaged — all pipelines are force-stopped.
            </p>
            <p className="text-muted-foreground">
              {data?.kill_switch.by ? `By ${data.kill_switch.by}. ` : ''}
              {data?.kill_switch.at
                ? new Date(data.kill_switch.at).toLocaleString()
                : ''}{' '}
              — click “Re-enable” to resume processing.
            </p>
          </div>
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline status…
        </div>
      ) : null}

      {/* Pipelines */}
      <div className="space-y-4">
        {(data?.pipelines ?? []).map((p) => (
          <FadeIn key={p.id}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">{p.name}</CardTitle>
                {p.trigger ? <Badge variant="outline">{p.trigger}</Badge> : null}
              </CardHeader>
              <CardContent>
                <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
                  {p.steps.map((step, i) => (
                    <React.Fragment key={step.id}>
                      <StepNode step={step} onSelect={openStep} />
                      {i < p.steps.length - 1 ? (
                        <div className="flex shrink-0 items-center text-muted-foreground">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>
                {p.branches.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.branches.map((b) => (
                      <Badge key={b} variant="secondary">
                        {b}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>

      {/* Companies fan-out */}
      {data?.companies?.length ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Companies:</span>
          {data.companies.map((c) => (
            <Badge key={c} variant="outline">
              {c}
            </Badge>
          ))}
          <Badge variant="muted">+ future</Badge>
        </div>
      ) : null}

      <StepConfigDialog
        step={activeStep}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
