'use client';

import { LandingContactChannels } from '@/components/landing/LandingContactChannels';
import {
  LandingSection,
  LandingSectionHeader,
} from '@/components/landing/LandingPrimitives';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingContact() {
  const copy = useLandingCopy();
  const { contact } = copy;

  return (
    <LandingSection id="contact" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <LandingSectionHeader title={contact.title} subtitle={contact.subtitle} />

      <p className="mb-8 text-center text-[14px] font-medium text-brand-gold">{contact.pricingNote}</p>

      <div className="mx-auto max-w-lg">
        <LandingContactChannels
          labels={{
            whatsappLabel: contact.whatsappLabel,
            wechatLabel: contact.wechatLabel,
            wechatScanHint: contact.wechatScanHint,
            wechatCopy: contact.wechatCopy,
            wechatCopied: contact.wechatCopied,
          }}
        />
      </div>

      <div className="mt-12">
        <h3 className="text-center font-heading text-xl text-brand-text">{contact.stepsTitle}</h3>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {contact.steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-brand-border bg-brand-bg p-4"
            >
              <p className="text-[12px] font-medium uppercase tracking-wider text-brand-gold">
                {index + 1}
              </p>
              <p className="mt-2 font-heading text-lg text-brand-text">{step.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-brand-text-muted">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </LandingSection>
  );
}
