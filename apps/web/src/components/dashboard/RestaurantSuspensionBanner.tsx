'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { licenseSuspensionCopy } from '@/lib/license-suspension-copy';

type Props = {
  reason?: string | null;
};

export function RestaurantSuspensionBanner({ reason }: Props) {
  const { lang } = useLanguage();
  const copy = licenseSuspensionCopy(lang, reason);

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">{copy.title}</p>
      <p className="mt-1 text-amber-900/80">{copy.body}</p>
      {copy.ctaHref ? (
        <p className="mt-2">
          <Link href={copy.ctaHref} className="font-medium text-amber-950 underline underline-offset-2">
            {copy.ctaLabel}
          </Link>
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-900/70">{copy.ctaLabel}</p>
      )}
    </div>
  );
}
