'use client';

import { LandingHeroStage } from '@/components/landing/LandingHeroStage';
import { LANDING_WRAP_CLASS } from '@/components/landing/landing-chrome';
import {
  LandingButton,
  LandingSection,
  LandingWhatsAppButton,
} from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

/** Keep each ` · `-separated clause intact so CJK/Latin never orphan mid-phrase. */
function HeroTitleLine({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(' · ');
  if (parts.length < 2) {
    return <span className={`block ${className}`.trim()}>{text}</span>;
  }
  return (
    <span className={`block ${className}`.trim()}>
      {parts.map((part, i) => (
        <span key={`${i}-${part}`}>
          {i > 0 ? ' · ' : null}
          <span className="whitespace-nowrap">{part}</span>
        </span>
      ))}
    </span>
  );
}

export function LandingHero() {
  const copy = useLandingCopy().hero;

  return (
    <LandingSection className="relative overflow-hidden border-b border-brand-border/60 bg-[radial-gradient(900px_520px_at_85%_10%,rgb(var(--color-brand-gold)/0.14),transparent_60%)] pb-24 pt-14 sm:pt-[72px]">
      <div className={`${LANDING_WRAP_CLASS} grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10`}>
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-brand-border/70 bg-brand-card px-3.5 py-1.5 text-[13px] font-medium text-brand-text-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            {copy.tag}
          </p>
          <h1 className="mt-5 font-heading text-[clamp(2.1rem,4.8vw,3.5rem)] font-bold leading-[1.16] tracking-tight text-brand-text">
            <HeroTitleLine text={copy.titleA} />
            <HeroTitleLine className="text-brand-gold" text={copy.titleB} />
          </h1>
          <p className="mx-auto mt-5 max-w-[34rem] text-base leading-relaxed text-brand-text-muted sm:text-lg lg:mx-0">
            {copy.desc}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:items-start">
            <LandingWhatsAppButton className="w-full sm:w-auto">{copy.whatsappCta}</LandingWhatsAppButton>
            <LandingButton href="#contact" variant="secondary" className="w-full sm:w-auto">
              {copy.wechatCta}
            </LandingButton>
          </div>
          <ul className="mt-8 flex list-none flex-wrap justify-center gap-x-6 gap-y-2.5 border-t border-brand-border/60 p-0 pt-6 lg:justify-start">
            {copy.proofs.map((proof) => (
              <li key={proof} className="inline-flex items-center gap-2 text-sm font-medium text-brand-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-gold" aria-hidden>
                  <path d="M5 12.5 10 17.5 19 7" />
                </svg>
                {proof}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-brand-text-muted">
            {copy.agentLead}{' '}
            <a
              href="#agents"
              className="underline decoration-brand-border underline-offset-4 transition-colors hover:text-brand-gold hover:decoration-brand-gold/45"
            >
              {copy.agentCta}
            </a>
          </p>
        </div>
        <LandingHeroStage />
      </div>
    </LandingSection>
  );
}
