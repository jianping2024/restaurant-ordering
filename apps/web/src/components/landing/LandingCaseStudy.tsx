'use client';

import Image from 'next/image';
import {
  LANDING_BLOCK_CLASS,
  LANDING_ON_DARK_ACCENT_CLASS,
  LANDING_ON_DARK_MUTED_CLASS,
  LANDING_PANEL_DARK_CLASS,
  LANDING_WRAP_CLASS,
} from '@/components/landing/landing-chrome';
import { LandingExternalLink, LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import {
  LANDING_CASE_VENUE,
  LANDING_CASE_VENUE_MAPS_URL,
  LANDING_CASE_VENUE_TEL_HREF,
} from '@/lib/landing/case-venue';
import { LANDING_PROOF_IMAGES } from '@/lib/landing/proof-assets';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

const FACT_ROW_CLASS = 'flex gap-[18px] border-b border-white/10 py-[13px] text-[14.5px]';
const FACT_LINK_CLASS = 'transition-colors hover:text-[#e0bd84]';

export function LandingCaseStudy() {
  const copy = useLandingCopy().caseStudy;

  return (
    <LandingSection id="case-study" className={LANDING_BLOCK_CLASS}>
      <div className={LANDING_WRAP_CLASS}>
        <LandingSectionHeader kicker={copy.kicker} title={copy.title} />
        <article className={`${LANDING_PANEL_DARK_CLASS} grid overflow-hidden rounded-[26px] lg:grid-cols-[1.05fr_0.95fr]`}>
          <div className="relative min-h-[360px]">
            <Image
              src={LANDING_PROOF_IMAGES.storefront}
              alt={LANDING_CASE_VENUE.name}
              fill
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover"
            />
            <div className="absolute inset-x-[18px] bottom-[18px] flex items-end gap-3">
              <Image
                src={LANDING_PROOF_IMAGES.cashier}
                alt={copy.photoCaption.replace('\n', ' ')}
                width={300}
                height={192}
                className="h-20 w-[112px] shrink-0 rounded-xl border-[3px] sm:h-24 sm:w-[150px] border-white/90 object-cover shadow-[0_10px_26px_rgba(0,0,0,0.4)]"
              />
              <span className="min-w-0 whitespace-pre-line rounded-[9px] bg-[#16222b]/80 px-3 py-[7px] text-[12.5px] leading-snug backdrop-blur-md">
                {copy.photoCaption}
              </span>
            </div>
          </div>
          <div className="flex flex-col p-6 sm:p-10">
            <p className={`inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.16em] before:h-px before:w-[22px] before:bg-[#e0bd84] before:content-[''] ${LANDING_ON_DARK_ACCENT_CLASS}`}>
              {copy.placeLine}
            </p>
            <h3 className="mt-3.5 font-heading text-[clamp(1.6rem,2.6vw,2.1rem)] font-bold leading-snug text-white">
              {LANDING_CASE_VENUE.name}
            </h3>
            <p className={`mt-3 ${LANDING_ON_DARK_MUTED_CLASS}`}>{copy.desc}</p>
            <ul className="mt-[26px] grid list-none grid-cols-1 gap-2.5 p-0 min-[420px]:grid-cols-2">
              {copy.results.map((result) => (
                <li key={result.title} className="rounded-xl border border-white/12 bg-white/[0.07] px-4 py-3.5">
                  <p className={`font-heading text-xl font-bold leading-snug ${LANDING_ON_DARK_ACCENT_CLASS}`}>{result.title}</p>
                  <p className={`text-[13px] ${LANDING_ON_DARK_MUTED_CLASS}`}>{result.desc}</p>
                </li>
              ))}
            </ul>
            <ul className="mt-[26px] list-none border-t border-white/10 p-0">
              <li className={FACT_ROW_CLASS}>
                <span className="w-16 shrink-0 text-[#8795a0]">{copy.addressLabel}</span>
                <LandingExternalLink href={LANDING_CASE_VENUE_MAPS_URL} className={FACT_LINK_CLASS}>
                  {LANDING_CASE_VENUE.address}
                </LandingExternalLink>
              </li>
              <li className={FACT_ROW_CLASS}>
                <span className="w-16 shrink-0 text-[#8795a0]">{copy.phoneLabel}</span>
                <a href={LANDING_CASE_VENUE_TEL_HREF} className={FACT_LINK_CLASS}>
                  {LANDING_CASE_VENUE.phoneDisplay}
                </a>
              </li>
              <li className={FACT_ROW_CLASS}>
                <span className="w-16 shrink-0 text-[#8795a0]">{copy.hoursLabel}</span>
                <span>{copy.hours}</span>
              </li>
            </ul>
            <ul className="mt-auto flex list-none flex-wrap gap-2 p-0 pt-[26px]">
              {copy.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-white/20 px-[13px] py-[5px] text-[12.5px] text-[#cfd8de]">
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </LandingSection>
  );
}
