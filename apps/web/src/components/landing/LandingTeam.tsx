'use client';

import Image from 'next/image';
import { LANDING_BLOCK_CLASS, LANDING_WRAP_CLASS } from '@/components/landing/landing-chrome';
import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { LANDING_TEAM_PHOTOS } from '@/lib/landing/proof-assets';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingTeam() {
  const copy = useLandingCopy().team;

  return (
    <LandingSection id="team" className={`${LANDING_BLOCK_CLASS} border-y border-brand-border/50 bg-brand-card/60`}>
      <div className={LANDING_WRAP_CLASS}>
        <LandingSectionHeader kicker={copy.kicker} title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-[18px] md:grid-cols-2">
          {copy.founders.map((founder, index) => (
            <article
              key={founder.name}
              className="grid items-start gap-6 rounded-[18px] border border-brand-border/60 bg-brand-bg p-[22px] sm:grid-cols-[150px_1fr]"
            >
              <Image
                src={LANDING_TEAM_PHOTOS[index]!}
                alt={founder.name}
                width={300}
                height={375}
                className="aspect-[16/11] w-full rounded-xl bg-brand-card object-cover object-[center_15%] sm:aspect-[4/5] sm:w-[150px] sm:object-[center_20%]"
              />
              <div>
                <h3 className="font-heading text-[19px] font-bold text-brand-text">{founder.name}</h3>
                <p className="text-[13.5px] font-semibold text-brand-gold">{founder.role}</p>
                <ul className="mt-1 list-none p-0">
                  {founder.points.map((point) => (
                    <li
                      key={point}
                      className="relative mt-2.5 pl-5 text-[14.5px] leading-relaxed text-brand-text-muted before:absolute before:left-0 before:top-[0.7em] before:h-[1.5px] before:w-2 before:bg-brand-gold before:content-['']"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-[18px] flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[18px] border border-brand-gold/25 bg-gradient-to-r from-brand-gold/10 to-transparent px-8 py-6">
          <p className="font-heading text-[clamp(1.1rem,2vw,1.4rem)] font-bold text-brand-text">{copy.formulaTitle}</p>
          <p className="text-[15px] text-brand-text-muted">{copy.formulaDesc}</p>
        </div>
      </div>
    </LandingSection>
  );
}
