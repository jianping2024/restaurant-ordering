'use client';

import { LANDING_BLOCK_CLASS, LANDING_WRAP_CLASS } from '@/components/landing/landing-chrome';
import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingPainPoints() {
  const copy = useLandingCopy().pain;

  return (
    <LandingSection id="solutions" className={LANDING_BLOCK_CLASS}>
      <div className={LANDING_WRAP_CLASS}>
        <LandingSectionHeader kicker={copy.kicker} title={copy.title} subtitle={copy.subtitle} />
        <div className="overflow-hidden rounded-[18px] border border-brand-border/70 bg-brand-card">
          {copy.items.map((item, index) => (
            <article
              key={item.title}
              className="grid border-brand-border/70 border-t first:border-t-0 md:grid-cols-[72px_1fr_56px_1.1fr]"
            >
              <p className="px-7 pt-7 font-heading text-sm font-bold text-brand-gold md:px-0 md:pl-[30px] md:pt-[34px]">
                {String(index + 1).padStart(2, '0')}
              </p>
              <div className="px-7 pb-1.5 pt-3 text-brand-text-muted md:py-[30px] md:pl-0 md:pr-5">
                <h3 className="mb-1.5 font-heading text-lg font-bold text-brand-text">{item.title}</h3>
                <p className="text-[15px] leading-relaxed">{item.problem}</p>
              </div>
              <div aria-hidden className="hidden items-center justify-center text-brand-gold md:flex">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </div>
              <p className="bg-gradient-to-r from-brand-gold/10 to-transparent px-7 pb-7 pt-4 text-base font-medium leading-relaxed text-brand-text md:flex md:items-center md:px-8 md:py-[30px]">
                {item.solution}
              </p>
            </article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
