'use client';

import Image from 'next/image';
import { LandingExternalLink, LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import {
  LANDING_CASE_VENUE,
  LANDING_CASE_VENUE_MAPS_URL,
  LANDING_CASE_VENUE_TEL_HREF,
} from '@/lib/landing/case-venue';
import { LANDING_PROOF_IMAGES } from '@/lib/landing/proof-assets';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

const VENUE_ROW_CLASS = 'text-[15px] leading-relaxed text-brand-text-muted';
const VENUE_LINK_CLASS =
  'text-brand-text-muted underline-offset-2 transition-colors hover:text-brand-gold hover:underline';

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
            <h3 className="font-heading text-2xl text-brand-text sm:text-3xl">{LANDING_CASE_VENUE.name}</h3>
            <div className="mt-4 flex flex-col gap-2">
              <p className={VENUE_ROW_CLASS}>
                <LandingExternalLink
                  href={LANDING_CASE_VENUE_MAPS_URL}
                  className={VENUE_LINK_CLASS}
                >
                  {LANDING_CASE_VENUE.address}
                </LandingExternalLink>
              </p>
              <p className={VENUE_ROW_CLASS}>
                <a href={LANDING_CASE_VENUE_TEL_HREF} className={VENUE_LINK_CLASS}>
                  {LANDING_CASE_VENUE.phoneDisplay}
                </a>
              </p>
              <p className={VENUE_ROW_CLASS}>{copy.hours}</p>
            </div>
          </div>
        </article>
      </div>
    </LandingSection>
  );
}
