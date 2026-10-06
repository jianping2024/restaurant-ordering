'use client';

import {
  LANDING_BLOCK_CLASS,
  LANDING_ON_DARK_ACCENT_CLASS,
  LANDING_ON_DARK_MUTED_CLASS,
  LANDING_PANEL_DARK_CLASS,
  LANDING_WRAP_CLASS,
} from '@/components/landing/landing-chrome';
import { LandingSection, LandingSectionHeader } from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

const CELL_CLASS =
  'relative overflow-hidden rounded-[18px] border p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(22,34,43,0.35)] sm:p-[30px]';
const CELL_LIGHT_CLASS = `${CELL_CLASS} border-brand-border/60 bg-brand-card`;
const CELL_DARK_CLASS = `${CELL_CLASS} border-[#16222b] ${LANDING_PANEL_DARK_CLASS}`;
const TAG_CLASS = 'text-xs font-semibold tracking-[0.1em] text-brand-gold';
const TITLE_CLASS = 'mt-2.5 font-heading text-[21px] font-bold leading-snug text-brand-text';
const DESC_CLASS = 'mt-2.5 text-[15px] leading-relaxed text-brand-text-muted';

/** Language chips show exactly the picker languages. */
const LANGUAGE_CHIPS = ['PT', 'EN', '中文'] as const;

export function LandingFeatures() {
  const copy = useLandingCopy().features;

  return (
    <LandingSection id="features" className={LANDING_BLOCK_CLASS}>
      <div className={LANDING_WRAP_CLASS}>
        <LandingSectionHeader kicker={copy.kicker} title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-[18px] md:grid-cols-6">
          <article className={`${CELL_DARK_CLASS} md:col-span-4`}>
            <p className={`${TAG_CLASS} ${LANDING_ON_DARK_ACCENT_CLASS}`}>{copy.price.tag}</p>
            <h3 className="mt-2.5 font-heading text-[21px] font-bold leading-snug text-white">{copy.price.title}</h3>
            <p className={`mt-2.5 text-[15px] leading-relaxed ${LANDING_ON_DARK_MUTED_CLASS}`}>{copy.price.desc}</p>
            <div className="mt-[22px] grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-3">
              {copy.price.slots.map((slot, index) => (
                <div
                  key={slot}
                  className={`rounded-xl border px-3.5 py-3 ${index === 1 ? 'border-[#e0bd84]/50 bg-[#e0bd84]/15' : 'border-white/10 bg-white/[0.07]'}`}
                >
                  <p className={`text-xs ${LANDING_ON_DARK_MUTED_CLASS}`}>{slot}</p>
                  <p className={`text-xl font-bold ${LANDING_ON_DARK_ACCENT_CLASS}`}>€ —</p>
                </div>
              ))}
            </div>
          </article>
          <article className={`${CELL_LIGHT_CLASS} md:col-span-2`}>
            <p className={TAG_CLASS}>{copy.language.tag}</p>
            <h3 className={TITLE_CLASS}>{copy.language.title}</h3>
            <p className={DESC_CLASS}>{copy.language.desc}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {LANGUAGE_CHIPS.map((chip, index) => (
                <span
                  key={chip}
                  className={`rounded-full border px-3.5 py-1 text-[13px] font-semibold ${index === 0 ? 'border-brand-gold bg-brand-gold text-brand-on-gold' : 'border-brand-border/70'}`}
                >
                  {chip}
                </span>
              ))}
            </div>
          </article>
          {[copy.collab, copy.insights, copy.printing].map((cell) => (
            <article key={cell.tag} className={`${CELL_LIGHT_CLASS} md:col-span-2`}>
              <p className={TAG_CLASS}>{cell.tag}</p>
              <h3 className={TITLE_CLASS}>{cell.title}</h3>
              <p className={DESC_CLASS}>{cell.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </LandingSection>
  );
}
