'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-header';
import { FadeIn } from '@/components/common/motion';
import { BrandForm } from '@/components/brands/brand-form';
import { useCreateBrand } from '@/lib/hooks';

export default function NewBrandPage() {
  const router = useRouter();
  const create = useCreateBrand();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <PageHeader
        title="New brand"
        description="Define the brand’s identity, voice, and publishing rules."
      />
      <FadeIn>
        <BrandForm
          submitting={create.isPending}
          onSubmit={(input) =>
            create.mutate(input, {
              onSuccess: (b) => router.push(`/brands/${b.id}`),
              // On mock/API-down, still navigate back to the list.
              onError: () => router.push('/brands'),
            })
          }
          onCancel={() => router.push('/brands')}
        />
      </FadeIn>
    </div>
  );
}
