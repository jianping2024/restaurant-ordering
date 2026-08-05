'use client';

import Image from 'next/image';
import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { LANDING_PROOF_IMAGES } from '@/lib/landing/proof-assets';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingCaseStudy() {
  const copy = useLandingCopy().caseStudy;

  return (
    <LandingSection
      id="case-study"
      className="border-t border-brand-border bg-brand-card/40 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <LandingSectionHeader title={copy.title} />
        <article className="overflow-hidden rounded-2xl border border-brand-border bg-brand-card">
          <div className="grid gap-2 p-3 sm:grid-cols-3 sm:p-4">
            {LANDING_PROOF_IMAGES.map((src) => (
              <div key={src} className="relative aspect-[16/10] overflow-hidden rounded-xl bg-brand-bg">
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
            ))}
          </div>
          <div className="border-t border-brand-border p-6 sm:p-8">
            <h3 className="font-heading text-2xl text-brand-text sm:text-3xl">{copy.name}</h3>
            <p className="mt-1 text-[14px] text-brand-gold">{copy.location}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-brand-text-muted">{copy.quote}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {copy.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-brand-border bg-brand-bg px-3 py-1 text-[12px] text-brand-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </article>
      </div>
    </LandingSection>
  );
}
