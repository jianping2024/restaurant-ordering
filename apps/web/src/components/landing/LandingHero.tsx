'use client';

import { PreviewMenuContent } from '@/components/landing/preview/PreviewMenuScreen';
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
    return <span className={`block whitespace-nowrap ${className}`.trim()}>{text}</span>;
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

function HeroPhonePreview() {
  return (
    <div className="mx-auto w-full max-w-[340px] md:mx-0 md:justify-self-end lg:max-w-[360px]">
      <PreviewMenuContent showLabel={false} />
    </div>
  );
}

export function LandingHero() {
  const copy = useLandingCopy().hero;

  return (
    <LandingSection className="border-b border-brand-border/70 bg-gradient-to-b from-brand-card/55 to-brand-bg">
      <div className="mx-auto grid max-w-6xl items-center gap-9 px-4 py-10 sm:px-6 sm:py-12 md:grid-cols-[minmax(0,1.15fr)_340px] md:gap-9 lg:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="text-center md:text-left">
          <p className="mb-3.5 text-[13px] font-medium uppercase tracking-widest text-brand-gold sm:text-sm">
            {copy.tag}
          </p>
          <h1 className="font-heading text-[clamp(1.75rem,3vw,2.65rem)] leading-snug text-brand-text">
            <HeroTitleLine text={copy.titleA} />
            <HeroTitleLine className="mt-[0.14em] text-gold-gradient" text={copy.titleB} />
          </h1>
          <p className="mx-auto mt-4 max-w-[38rem] text-base leading-relaxed text-brand-text-muted md:mx-0">
            {copy.desc}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap md:items-start">
            <LandingWhatsAppButton className="w-full sm:w-auto">
              {copy.whatsappCta}
            </LandingWhatsAppButton>
            <LandingButton href="#contact" variant="secondary" className="w-full sm:w-auto">
              {copy.wechatCta}
            </LandingButton>
          </div>
          <ul className="mt-5 flex list-none flex-wrap justify-center gap-2 p-0 md:justify-start">
            {copy.proofs.map((proof) => (
              <li
                key={proof}
                className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-card px-3 py-2 text-[13px] font-medium text-brand-text"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold"
                />
                {proof}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-brand-text-muted">
            {copy.agentLead}{' '}
            <a
              href="#agents"
              className="text-brand-text-muted underline decoration-brand-border underline-offset-4 transition-colors hover:text-brand-gold hover:decoration-brand-gold/45"
            >
              {copy.agentCta}
            </a>
          </p>
        </div>
        <HeroPhonePreview />
      </div>
    </LandingSection>
  );
}
