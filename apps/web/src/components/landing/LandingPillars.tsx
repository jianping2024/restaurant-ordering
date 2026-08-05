'use client';

import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingPillars() {
  const copy = useLandingCopy().pillars;

  return (
    <LandingSection
      id="pillars"
      className="border-t border-brand-border bg-brand-card/30 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <LandingSectionHeader title={copy.title} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-brand-border bg-brand-card p-5"
            >
              <h3 className="font-heading text-lg text-brand-gold sm:text-xl">{item.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-brand-text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
