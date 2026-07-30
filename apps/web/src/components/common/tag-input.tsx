'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Comma / Enter separated tag editor for arrays (products, competitors, …). */
export function TagInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = React.useState('');

  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = Array.from(new Set([...value, ...parts]));
    onChange(next);
    setDraft('');
  };

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring',
      )}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="h-7 min-w-[120px] flex-1 border-0 p-0 px-1 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
