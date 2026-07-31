'use client';

import * as React from 'react';
import { BookOpen, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  useAddBrandKnowledge,
  useBrandKnowledge,
  useRefreshBrandKnowledge,
  useRemoveBrandKnowledge,
} from '@/lib/hooks/brand-knowledge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

/** Per-brand knowledge base (RAG): list, add manually, or let the AI research it. */
export function BrandKnowledge({ brandId }: { brandId: string }) {
  const { data, isLoading } = useBrandKnowledge(brandId);
  const add = useAddBrandKnowledge(brandId);
  const refresh = useRefreshBrandKnowledge(brandId);
  const remove = useRemoveBrandKnowledge(brandId);
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');

  const items = data?.items ?? [];

  function submit() {
    if (!title.trim() || !content.trim()) return;
    add.mutate(
      { title, content },
      { onSuccess: () => { setTitle(''); setContent(''); } },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Knowledge base (RAG)</CardTitle>
          <CardDescription>
            What the AI knows about this brand — used to keep generated content
            on-brand. Add facts, or let the AI research and refresh it.
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          {refresh.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Refresh with AI
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add manually */}
        <div className="space-y-2 rounded-lg border border-border p-3">
          <Input
            placeholder="Title (e.g. Target audience)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Fact / knowledge…"
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button size="sm" onClick={submit} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" /> No knowledge yet — add one or click
            “Refresh with AI”.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((k) => (
              <div key={k.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{k.title}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={k.source === 'ai' ? 'secondary' : 'outline'}>
                      {k.source === 'ai' ? 'AI' : k.source}
                    </Badge>
                    <button
                      aria-label="Remove"
                      onClick={() => remove.mutate(k.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{k.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
