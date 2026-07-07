'use client';

import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingPainPoints() {
  const copy = useLandingCopy().pain;

  return (
    <LandingSection
      id="solutions"
      className="border-t border-brand-border bg-brand-card/40 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <LandingSectionHeader title={copy.title} />
        <div className="grid gap-4 md:grid-cols-3">
          {copy.items.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-brand-border bg-brand-card p-5 sm:p-6"
            >
              <h3 className="font-heading text-lg text-brand-gold sm:text-xl">{item.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-brand-text-muted">
                {item.problem}
              </p>
              <p className="mt-4 border-t border-brand-border pt-4 text-[14px] leading-relaxed text-brand-text">
                {item.solution}
              </p>
            </article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
