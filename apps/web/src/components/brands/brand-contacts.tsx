'use client';

import * as React from 'react';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import {
  useAddContacts,
  useContacts,
  useRemoveContact,
} from '@/lib/hooks/contacts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * Per-brand contacts/leads — the in-app replacement for CSV-in-Drive. When a
 * contact has status `new`, AI 1 branches this brand's next run to Pipeline 2
 * (video). Once run, it flips to `processed`.
 */
export function BrandContacts({ brandId }: { brandId: string }) {
  const { data, isLoading } = useContacts(brandId);
  const add = useAddContacts(brandId);
  const remove = useRemoveContact(brandId);
  const [name, setName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [company, setCompany] = React.useState('');

  const items = data?.items ?? [];
  const newCount = items.filter((c) => c.status === 'new').length;

  function submit() {
    if (!name.trim() && !handle.trim() && !company.trim()) return;
    add.mutate([{ name, handle, company }], {
      onSuccess: () => {
        setName('');
        setHandle('');
        setCompany('');
      },
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Contacts / leads</CardTitle>
          <CardDescription>
            The data source AI 1 checks — no CSV needed. New contacts trigger
            Pipeline 2 (video) on this brand’s next run; otherwise it runs
            Pipeline 3 (research).
          </CardDescription>
        </div>
        {newCount > 0 ? (
          <Badge variant="secondary">{newCount} new → Pipeline 2</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add */}
        <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <Input
            placeholder="Handle (@…)"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <Button size="sm" onClick={submit} disabled={add.isPending}>
              {add.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> No contacts yet — add one to feed AI 1.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.name || c.handle || c.company || 'Contact'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.handle, c.company].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={c.status === 'new' ? 'secondary' : 'outline'}>
                    {c.status}
                  </Badge>
                  <button
                    aria-label="Remove"
                    onClick={() => remove.mutate(c.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
