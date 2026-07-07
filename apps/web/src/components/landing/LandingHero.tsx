'use client';

import { PreviewBarContent } from '@/components/landing/preview/PreviewBarScreen';
import { PreviewMenuContent } from '@/components/landing/preview/PreviewMenuScreen';
import { PreviewWaiterOpenContent } from '@/components/landing/preview/PreviewWaiterOpenScreen';
import {
  LandingButton,
  LandingSection,
  LandingWhatsAppButton,
} from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

function HeroPreviewStack() {
  return (
    <div className="relative mx-auto w-full max-w-md md:max-w-none">
      <div
        aria-hidden
        className="pointer-events-none relative h-[420px] sm:h-[460px]"
      >
        <div className="absolute right-0 top-6 w-[88%] opacity-40 md:w-[78%]">
          <div className="origin-top-right scale-[0.34] sm:scale-[0.38]">
            <PreviewBarContent showLabel={false} />
          </div>
        </div>
        <div className="absolute left-0 top-10 w-[76%] opacity-55 md:w-[68%]">
          <div className="origin-top-left scale-[0.32] sm:scale-[0.36]">
            <PreviewWaiterOpenContent showLabel={false} />
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 z-10 w-[92%] max-w-[320px] -translate-x-1/2">
          <PreviewMenuContent showLabel={false} />
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  const copy = useLandingCopy().hero;

  return (
    <LandingSection className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
        <div className="text-center md:text-left">
          <p className="mb-4 text-[13px] font-medium uppercase tracking-widest text-brand-gold sm:mb-6 sm:text-sm">
            {copy.tag}
          </p>
          <h1 className="font-heading text-4xl leading-tight text-brand-text sm:text-5xl lg:text-6xl">
            {copy.titleA}
            <br />
            <span className="text-gold-gradient">{copy.titleB}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-brand-text-muted sm:text-lg md:mx-0">
            {copy.desc}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <LandingWhatsAppButton className="w-full sm:w-auto">
              {copy.whatsappCta}
            </LandingWhatsAppButton>
            <LandingButton href="#contact" variant="secondary" className="w-full sm:w-auto">
              {copy.wechatCta}
            </LandingButton>
          </div>
          <p className="mt-4 text-[13px] text-brand-text-muted">
            <a href="#preview" className="hover:text-brand-gold">
              {copy.previewHint} ↓
            </a>
          </p>
        </div>
        <HeroPreviewStack />
      </div>
    </LandingSection>
  );
}
