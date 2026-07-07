'use client';

import { useState } from 'react';
import {
  LandingSection,
  LandingSectionHeader,
  LandingWhatsAppButton,
} from '@/components/landing/LandingPrimitives';
import {
  LANDING_PREVIEW_COMPONENTS,
  LANDING_PREVIEW_SCREEN_IDS,
  type LandingPreviewScreenId,
} from '@/lib/landing/preview-screens';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingProductPreview() {
  const copy = useLandingCopy();
  const { preview } = copy;
  const [activeId, setActiveId] = useState<LandingPreviewScreenId>(LANDING_PREVIEW_SCREEN_IDS[0]);

  const activeScreen = preview.screens.find((screen) => screen.id === activeId);
  const PreviewComponent = LANDING_PREVIEW_COMPONENTS[activeId];

  return (
    <LandingSection id="preview" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
      <LandingSectionHeader title={preview.title} subtitle={preview.subtitle} />

      <div className="flex flex-wrap justify-center gap-2">
        {preview.screens.map((screen) => {
          const isActive = screen.id === activeId;
          return (
            <button
              key={screen.id}
              type="button"
              onClick={() => setActiveId(screen.id)}
              className={`rounded-full px-4 py-2 text-[13px] transition-colors ${
                isActive
                  ? 'bg-brand-gold text-brand-on-gold'
                  : 'border border-brand-border text-brand-text-muted hover:border-brand-gold/40 hover:text-brand-text'
              }`}
            >
              {screen.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-border bg-brand-card/50 p-3 sm:p-5">
        <div className="pointer-events-none mx-auto max-h-[640px] overflow-hidden">
          <div className="origin-top scale-[0.72] sm:scale-[0.82] md:scale-[0.9] lg:scale-100">
            <PreviewComponent showLabel={false} />
          </div>
        </div>
        {activeScreen ? (
          <p className="mt-4 text-center text-[14px] text-brand-text-muted">{activeScreen.caption}</p>
        ) : null}
      </div>

      <div className="mt-8 text-center">
        <LandingWhatsAppButton variant="secondary">{preview.remoteDemo}</LandingWhatsAppButton>
      </div>
    </LandingSection>
  );
}
