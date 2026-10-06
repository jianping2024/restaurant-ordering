'use client';

import { LANDING_BLOCK_CLASS, LANDING_WRAP_CLASS } from '@/components/landing/landing-chrome';
import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingFlow() {
  const copy = useLandingCopy().flow;

  return (
    <LandingSection id="flow" className={`${LANDING_BLOCK_CLASS} border-y border-brand-border/50 bg-brand-card/60`}>
      <div className={LANDING_WRAP_CLASS}>
        <LandingSectionHeader kicker={copy.kicker} title={copy.title} subtitle={copy.subtitle} />
        <ol className="relative grid list-none gap-5 p-0 md:grid-cols-4 md:gap-0 md:before:absolute md:before:left-[8%] md:before:right-[8%] md:before:top-[27px] md:before:h-px md:before:bg-[repeating-linear-gradient(90deg,rgb(var(--color-brand-border))_0_6px,transparent_6px_12px)] md:before:content-['']">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="relative min-h-14 pl-[70px] md:px-[18px] md:pl-[18px]">
              <span className="absolute left-0 top-0 z-[1] grid h-[54px] w-[54px] place-items-center rounded-full border border-brand-border/70 bg-brand-bg font-heading text-lg font-bold text-brand-gold md:static">
                {index + 1}
              </span>
              <h3 className="mt-0.5 font-heading text-[17px] font-bold text-brand-text md:mt-5">{step.title}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-brand-text-muted">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </LandingSection>
  );
}
