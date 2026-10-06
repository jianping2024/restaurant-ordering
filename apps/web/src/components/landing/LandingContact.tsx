'use client';

import { LandingAdvisorContact } from '@/components/landing/LandingAdvisorContact';
import { LANDING_BLOCK_CLASS, LANDING_WRAP_CLASS } from '@/components/landing/landing-chrome';
import { LandingSection } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingContact() {
  const { contact } = useLandingCopy();

  return (
    <LandingSection id="contact" className={LANDING_BLOCK_CLASS}>
      <div className={LANDING_WRAP_CLASS}>
        <div className="grid overflow-hidden rounded-[26px] border border-brand-border/70 bg-brand-card lg:grid-cols-2">
          <div className="p-6 sm:p-12">
            <p className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand-gold before:h-px before:w-[22px] before:bg-brand-gold before:content-['']">
              {contact.kicker}
            </p>
            <h2 className="mt-3.5 whitespace-pre-line font-heading text-[clamp(1.7rem,3.1vw,2.5rem)] font-bold leading-[1.28] tracking-tight text-brand-text">
              {contact.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-brand-text-muted sm:text-[17px]">{contact.subtitle}</p>
            <ol className="mt-8 grid list-none gap-3.5 p-0">
              {contact.steps.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3.5 text-[15px]">
                  <span
                    aria-hidden
                    className="mt-px grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[#16222b] text-[13px] font-semibold text-white"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-brand-text">{step.title}</p>
                    <p className="text-sm text-brand-text-muted">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p id="agents" className="mt-8 scroll-mt-24 border-t border-dashed border-brand-border/70 pt-5 text-[14.5px] text-brand-text-muted">
              <span className="font-semibold text-brand-gold">{contact.agent.title}</span> · {contact.agent.subtitle}
            </p>
          </div>
          <LandingAdvisorContact />
        </div>
      </div>
    </LandingSection>
  );
}
