'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  LANDING_ON_DARK_MUTED_CLASS,
  LANDING_PANEL_DARK_CLASS,
} from '@/components/landing/landing-chrome';
import { LandingExternalLink } from '@/components/landing/LandingPrimitives';
import { LANDING_CONTACT_PEOPLE } from '@/lib/landing/contact';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

/** Landing sole contact entry: one panel, one advisor at a time (names from `copy.team.founders`). */
export function LandingAdvisorContact() {
  const { contact, team } = useLandingCopy();
  const [active, setActive] = useState(0);
  const person = LANDING_CONTACT_PEOPLE[active]!;

  return (
    <div className={`${LANDING_PANEL_DARK_CLASS} flex flex-col justify-center gap-5 p-6 sm:p-11`}>
      <div className="grid gap-1 text-center">
        <p className="font-heading text-[22px] font-bold text-white">{contact.panelTitle}</p>
      </div>
      <div
        role="tablist"
        aria-label={contact.advisorsLabel}
        className="flex gap-1 rounded-xl border border-white/12 bg-white/[0.08] p-1"
      >
        {team.founders.map((founder, index) => (
          <button
            key={founder.name}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={`h-10 flex-1 rounded-[9px] text-sm font-semibold transition-colors ${index === active ? 'bg-white text-[#16222b]' : `${LANDING_ON_DARK_MUTED_CLASS} hover:text-white`}`}
          >
            {founder.name}
          </button>
        ))}
      </div>
      <div className="grid justify-items-center gap-4">
        <div className="rounded-[18px] bg-white p-3.5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
          <Image
            src={person.wechat.qrPath}
            alt={`${contact.wechatLabel} ${person.wechat.display}`}
            width={200}
            height={200}
            className="h-[200px] w-[200px] object-contain"
          />
        </div>
        <div className="text-center">
          <p className="text-xs tracking-[0.14em] text-[#8795a0]">{contact.wechatIdLabel}</p>
          <p className="text-[22px] font-bold">{person.wechat.display}</p>
          <p className={`text-[13px] ${LANDING_ON_DARK_MUTED_CLASS}`}>{contact.wechatScanHint}</p>
        </div>
        <LandingExternalLink
          href={person.whatsapp.waUrl}
          className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[14px] bg-gradient-to-b from-[#b98a45] to-[#8b6530] px-5 py-[15px] text-base font-semibold text-white transition-transform hover:-translate-y-px"
        >
          <span className="inline-flex items-center gap-2.5">
            <i aria-hidden className="h-[9px] w-[9px] rounded-full bg-[#7cf0a8]" />
            {contact.whatsappLabel}
          </span>
          <span className="whitespace-nowrap text-[15px] font-medium">{person.whatsapp.display} →</span>
        </LandingExternalLink>
      </div>
    </div>
  );
}
