'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Library,
  Plug,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/page-header';
import { FadeIn } from '@/components/common/motion';
import { IntegrationsPanel } from '@/components/settings/integrations-panel';
import { useMe, usePromptTemplates } from '@/lib/hooks';

const MASKED_KEY = 'mf_live_sk_••••••••••••••••••••••••7f2a';

export default function SettingsPage() {
  const { data: me } = useMe();
  const { data: templates } = usePromptTemplates();
  const [revealed, setRevealed] = React.useState(false);
  const user = me?.data.user;
  const org = me?.data.org;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your organization, profile, keys, and integrations."
      />

      <Tabs defaultValue="org">
        <TabsList className="flex-wrap">
          <TabsTrigger value="org">
            <UserIcon className="h-4 w-4" />
            Organization
          </TabsTrigger>
          <TabsTrigger value="keys">
            <KeyRound className="h-4 w-4" />
            API keys
          </TabsTrigger>
          <TabsTrigger value="prompts">
            <Library className="h-4 w-4" />
            Prompt library
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="org">
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle>Organization & profile</CardTitle>
                <CardDescription>
                  Basic details for {org?.name ?? 'your workspace'}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block" htmlFor="org-name">
                    Organization name
                  </Label>
                  <Input id="org-name" defaultValue={org?.name ?? ''} />
                </div>
                <div>
                  <Label className="mb-1.5 block" htmlFor="org-slug">
                    Slug
                  </Label>
                  <Input id="org-slug" defaultValue={org?.slug ?? ''} />
                </div>
                <div>
                  <Label className="mb-1.5 block" htmlFor="full-name">
                    Your name
                  </Label>
                  <Input id="full-name" defaultValue={user?.full_name ?? ''} />
                </div>
                <div>
                  <Label className="mb-1.5 block" htmlFor="email">
                    Email
                  </Label>
                  <Input id="email" defaultValue={user?.email ?? ''} disabled />
                </div>
                <div className="sm:col-span-2">
                  <Button onClick={() => toast.success('Settings saved')}>
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </TabsContent>

        <TabsContent value="keys">
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle>API keys</CardTitle>
                <CardDescription>
                  Use these to authenticate programmatic access. Keys are shown
                  once at creation, then stored hashed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 rounded-md border border-border p-3">
                  <code className="flex-1 truncate font-mono text-sm">
                    {revealed ? MASKED_KEY.replace(/•+/, 'a91c4be22d10f8') : MASKED_KEY}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={revealed ? 'Hide key' : 'Reveal key'}
                    onClick={() => setRevealed((r) => !r)}
                  >
                    {revealed ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy key"
                    onClick={() => {
                      navigator.clipboard?.writeText(MASKED_KEY);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" onClick={() => toast('Admin only in production')}>
                  <KeyRound className="h-4 w-4" />
                  Generate new key
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        </TabsContent>

        <TabsContent value="prompts">
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle>Prompt library</CardTitle>
                <CardDescription>
                  Reusable prompt templates for content and review agents.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(templates?.data.items ?? []).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{t.name}</p>
                      <div className="flex items-center gap-1.5">
                        {t.org_id === null ? (
                          <Badge variant="secondary">Global</Badge>
                        ) : null}
                        <Badge variant="muted">v{t.version}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground line-clamp-2">
                      {t.body}
                    </p>
                    <Badge variant="outline" className="mt-2 capitalize">
                      {t.agent_type.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </FadeIn>
        </TabsContent>

        <TabsContent value="integrations">
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>
                  Connect the AI, publishing, and storage providers that power
                  research, generation, and publishing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IntegrationsPanel />
              </CardContent>
            </Card>
          </FadeIn>
        </TabsContent>
      </Tabs>

      <p className="text-sm text-muted-foreground">
        Looking for prompt versioning?{' '}
        <Link href="/settings" className="text-primary hover:underline">
          Open the prompt library
        </Link>
        .
      </p>
    </div>
  );
}
