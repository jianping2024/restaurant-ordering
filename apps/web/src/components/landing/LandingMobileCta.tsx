'use client';

import { LandingButton, LandingWhatsAppButton } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

/** Phone-only sticky entry; the page reserves bottom padding for it. */
export function LandingMobileCta() {
  const copy = useLandingCopy();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex gap-2.5 border-t border-brand-border/70 bg-brand-bg/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md md:hidden">
      <LandingWhatsAppButton className="h-[46px] flex-1 !py-0">{copy.contact.whatsappLabel}</LandingWhatsAppButton>
      <LandingButton href="#contact" className="h-[46px] flex-1 !border !border-white/15 !bg-[#16222b] !py-0 !text-white">
        {copy.nav.demo}
      </LandingButton>
    </div>
  );
}
