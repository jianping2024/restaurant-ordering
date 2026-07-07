'use client';

import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingBuffetFeatures() {
  const { buffet, support } = useLandingCopy();

  return (
    <>
      <LandingSection className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <LandingSectionHeader title={buffet.title} subtitle={buffet.subtitle} />
        <div className="grid gap-4 sm:grid-cols-2">
          {buffet.items.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-brand-border bg-brand-card p-5 sm:p-6 card-hover"
            >
              <h3 className="font-heading text-lg text-brand-gold sm:text-xl">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-brand-text-muted sm:text-sm">
                {item.desc}
              </p>
            </article>
          ))}
        </div>
      </LandingSection>

      <LandingSection className="border-t border-brand-border bg-brand-card/30 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <LandingSectionHeader title={support.title} />
          <div className="grid gap-4 md:grid-cols-3">
            {support.items.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-brand-border bg-brand-bg p-5"
              >
                <h3 className="font-heading text-lg text-brand-text">{item.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-brand-text-muted">
                  {item.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </LandingSection>
    </>
  );
}
