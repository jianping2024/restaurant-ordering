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
    <div className="mx-auto w-full max-w-[300px] md:mx-0 md:justify-self-end lg:max-w-[320px]">
      <PreviewMenuContent showLabel={false} />
    </div>
  );
}

export function LandingHero() {
  const copy = useLandingCopy().hero;

  return (
    <LandingSection className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_300px] md:gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="text-center md:text-left">
          <p className="mb-4 text-[13px] font-medium uppercase tracking-widest text-brand-gold sm:text-sm">
            {copy.tag}
          </p>
          <h1 className="font-heading text-[clamp(1.75rem,4.2vw,2.75rem)] leading-snug text-brand-text">
            <HeroTitleLine text={copy.titleA} />
            <HeroTitleLine className="mt-[0.12em] text-gold-gradient" text={copy.titleB} />
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-brand-text-muted sm:text-lg md:mx-0">
            {copy.desc}
          </p>
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap md:items-start">
            <LandingWhatsAppButton className="w-full sm:w-auto">
              {copy.whatsappCta}
            </LandingWhatsAppButton>
            <LandingButton href="#contact" variant="secondary" className="w-full sm:w-auto">
              {copy.wechatCta}
            </LandingButton>
          </div>
          <p className="mt-3.5 text-[14px] text-brand-text-muted">
            <a
              href="#agents"
              className="text-brand-gold underline decoration-brand-gold/35 underline-offset-4 transition-colors hover:decoration-brand-gold"
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
