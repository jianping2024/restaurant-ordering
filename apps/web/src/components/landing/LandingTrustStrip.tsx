'use client';

import {
  LANDING_ON_DARK_ACCENT_CLASS,
  LANDING_ON_DARK_MUTED_CLASS,
  LANDING_PANEL_DARK_CLASS,
  LANDING_WRAP_CLASS,
} from '@/components/landing/landing-chrome';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingTrustStrip() {
  const items = useLandingCopy().strip;

  return (
    <div className={LANDING_PANEL_DARK_CLASS}>
      <div className={`${LANDING_WRAP_CLASS} grid grid-cols-2 md:grid-cols-4`}>
        {items.map((item, index) => (
          <div
            key={item.title}
            className={`border-white/10 px-5 py-7 ${index % 2 === 1 ? 'border-l' : ''} ${index >= 2 ? 'border-t md:border-t-0' : ''} md:border-l md:first:border-l-0`}
          >
            <p className={`font-heading text-[22px] font-bold leading-tight ${LANDING_ON_DARK_ACCENT_CLASS}`}>
              {item.title}
            </p>
            <p className={`mt-1 text-[13.5px] ${LANDING_ON_DARK_MUTED_CLASS}`}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
