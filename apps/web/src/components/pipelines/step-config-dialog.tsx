'use client';

import * as React from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { StepView } from '@/lib/hooks/pipelines';
import { useSetStepProvider } from '@/lib/hooks/pipelines';
import {
  type Integration,
  useIntegrations,
  useSetIntegration,
} from '@/lib/hooks/integrations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/** Inline credential editor for the chosen provider (reuses /integrations). */
function ProviderKeyForm({ integration }: { integration: Integration }) {
  const setMut = useSetIntegration();
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      integration.fields.map((f) => [f.key, f.secret ? '' : f.value]),
    ),
  );

  function save() {
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== ''),
    );
    setMut.mutate({ provider: integration.id, values: payload });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{integration.name} — API key</p>
        {integration.configured ? (
          <Badge variant="secondary" className="gap-1">
            <Check className="h-3 w-3" /> Saved
          </Badge>
        ) : (
          <Badge variant="outline">Not saved</Badge>
        )}
      </div>
      <div className="grid gap-2">
        {integration.fields.map((f) => {
          const id = `pk-${integration.id}-${f.key}`;
          const placeholder =
            f.secret && f.is_set
              ? '•••••••• (saved — leave blank to keep)'
              : (f.placeholder ?? '');
          return (
            <div key={f.key}>
              <Label className="mb-1 block text-xs" htmlFor={id}>
                {f.label}
                {f.optional ? (
                  <span className="text-muted-foreground"> (optional)</span>
                ) : null}
              </Label>
              {f.multiline ? (
                <Textarea
                  id={id}
                  rows={3}
                  className="font-mono text-xs"
                  value={values[f.key] ?? ''}
                  placeholder={placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              ) : (
                <Input
                  id={id}
                  type={f.secret ? 'password' : 'text'}
                  autoComplete="off"
                  value={values[f.key] ?? ''}
                  placeholder={placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
            </div>
          );
        })}
      </div>
      <Button size="sm" onClick={save} disabled={setMut.isPending}>
        {setMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save API key
      </Button>
    </div>
  );
}

export function StepConfigDialog({
  step,
  open,
  onOpenChange,
}: {
  step: StepView | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: integrations } = useIntegrations();
  const setProvider = useSetStepProvider();
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [model, setModel] = React.useState<string | null>(null);

  // Reset the selection whenever a different step opens.
  React.useEffect(() => {
    setChosen(step?.selected_provider ?? null);
    setModel(step?.selected_model ?? null);
  }, [step]);

  if (!step) return null;

  const integrationFor = (id: string) =>
    integrations?.items.find((i) => i.id === id);
  const chosenOption = step.provider_options.find((o) => o.id === chosen);
  const models = chosenOption?.models ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure: {step.label}</DialogTitle>
          <DialogDescription>
            Choose which AI powers this step, then save that provider&apos;s API key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider choices */}
          <div className="grid gap-2">
            {step.provider_options.map((opt) => {
              const integ = integrationFor(opt.id);
              const selected = chosen === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setChosen(opt.id);
                    setModel(
                      step.selected_provider === opt.id
                        ? (step.selected_model ?? opt.models[0] ?? null)
                        : (opt.models[0] ?? null),
                    );
                  }}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition ${
                    selected
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        selected ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    />
                    <span className="text-sm font-medium">{opt.name}</span>
                    {step.selected_provider === opt.id ? (
                      <Badge variant="secondary">Current</Badge>
                    ) : null}
                  </div>
                  {integ?.configured ? (
                    <Badge variant="outline" className="gap-1">
                      <Check className="h-3 w-3" /> Key saved
                    </Badge>
                  ) : (
                    <Badge variant="outline">No key</Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Model picker for the chosen provider */}
          {chosen && models.length ? (
            <div>
              <label
                htmlFor="step-model"
                className="mb-1.5 block text-xs font-medium"
              >
                Model
              </label>
              <select
                id="step-model"
                value={model ?? ''}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Key form for the chosen provider */}
          {chosen && integrationFor(chosen) ? (
            <ProviderKeyForm integration={integrationFor(chosen)!} />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!chosen || setProvider.isPending}
            onClick={() => {
              if (!chosen) return;
              setProvider.mutate(
                { stepId: step.id, provider: chosen, ...(model ? { model } : {}) },
                { onSuccess: () => onOpenChange(false) },
              );
            }}
          >
            {setProvider.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Use this provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
