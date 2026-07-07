'use client';

import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingCaseStudy() {
  const copy = useLandingCopy().caseStudy;

  return (
    <LandingSection
      id="case-study"
      className="border-t border-brand-border bg-brand-card/40 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <LandingSectionHeader title={copy.title} />
        <article className="mx-auto max-w-3xl rounded-2xl border border-brand-border bg-brand-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div
              aria-hidden
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-brand-gold/30 bg-brand-gold/10 font-heading text-2xl text-brand-gold"
            >
              ⚓
            </div>
            <div>
              <h3 className="font-heading text-2xl text-brand-text sm:text-3xl">{copy.name}</h3>
              <p className="mt-1 text-[14px] text-brand-gold">{copy.location}</p>
              <p className="mt-4 text-[15px] leading-relaxed text-brand-text-muted">{copy.quote}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {copy.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-brand-border bg-brand-bg px-3 py-1 text-[12px] text-brand-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>
      </div>
    </LandingSection>
  );
}
