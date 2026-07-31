'use client';

import * as React from 'react';
import { Check, Loader2, Plug, Trash2 } from 'lucide-react';
import {
  type Integration,
  useIntegrations,
  useRemoveIntegration,
  useSetIntegration,
} from '@/lib/hooks/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const CATEGORY_LABELS: Record<Integration['category'], string> = {
  ai_text: 'AI — text',
  ai_image: 'AI — image & video',
  ai_voice: 'AI — voice',
  publishing: 'Publishing',
  storage: 'Storage',
};

const CATEGORY_ORDER: Integration['category'][] = [
  'ai_text',
  'ai_image',
  'ai_voice',
  'publishing',
  'storage',
];

function ProviderCard({ integration }: { integration: Integration }) {
  const setMut = useSetIntegration();
  const removeMut = useRemoveIntegration();
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      integration.fields.map((f) => [f.key, f.secret ? '' : f.value]),
    ),
  );

  function save() {
    // Only send non-empty fields — the API merges, so blank secret fields keep
    // the stored value.
    const payload = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v !== ''),
    );
    setMut.mutate({ provider: integration.id, values: payload });
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{integration.name}</p>
            {integration.configured ? (
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not configured</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {integration.description}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {integration.fields.map((f) => {
          const id = `${integration.id}-${f.key}`;
          const placeholder =
            f.secret && f.is_set
              ? '•••••••• (set — leave blank to keep)'
              : (f.placeholder ?? '');
          return (
            <div key={f.key} className={f.multiline ? 'sm:col-span-2' : ''}>
              <Label className="mb-1.5 block text-xs" htmlFor={id}>
                {f.label}
                {f.optional ? (
                  <span className="text-muted-foreground"> (optional)</span>
                ) : null}
              </Label>
              {f.multiline ? (
                <Textarea
                  id={id}
                  rows={3}
                  value={values[f.key] ?? ''}
                  placeholder={placeholder}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  className="font-mono text-xs"
                />
              ) : (
                <Input
                  id={id}
                  type={f.secret ? 'password' : 'text'}
                  autoComplete="off"
                  value={values[f.key] ?? ''}
                  placeholder={placeholder}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={setMut.isPending}>
          {setMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {integration.configured ? 'Update' : 'Connect'}
        </Button>
        {integration.configured ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => removeMut.mutate(integration.id)}
            disabled={removeMut.isPending}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function IntegrationsPanel() {
  const { data, isLoading, isError } = useIntegrations();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading integrations…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        Couldn&apos;t load integrations. Admin access is required to manage them.
      </p>
    );
  }

  const items = data.items;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Plug className="h-4 w-4" />
        Connect the AI, publishing, and storage providers that power the
        platform. Keys are encrypted at rest and never shown again.
      </div>
      {CATEGORY_ORDER.map((cat) => {
        const group = items.filter((i) => i.category === cat);
        if (group.length === 0) return null;
        return (
          <div key={cat} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="grid gap-3">
              {group.map((i) => (
                <ProviderCard key={i.id} integration={i} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
