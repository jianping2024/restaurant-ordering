'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  LandingExternalLink,
  LandingSection,
  LandingSectionHeader,
  LandingWhatsAppButton,
} from '@/components/landing/LandingPrimitives';
import {
  LANDING_PHONE_CONTACTS,
  LANDING_WECHAT_ID,
  LANDING_WECHAT_QR_PATH,
} from '@/lib/landing/contact';
import { useLandingCopy } from '@/lib/landing/use-landing-copy';

export function LandingContact() {
  const copy = useLandingCopy();
  const { contact, hero } = copy;
  const [copied, setCopied] = useState(false);

  const copyWeChatId = async () => {
    try {
      await navigator.clipboard.writeText(LANDING_WECHAT_ID);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <LandingSection id="contact" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <LandingSectionHeader title={contact.title} subtitle={contact.subtitle} />

      <p className="mb-8 text-center text-[14px] font-medium text-brand-gold">{contact.pricingNote}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-brand-border bg-brand-card p-6">
          <h3 className="font-heading text-xl text-brand-text">{contact.whatsappLabel}</h3>
          <ul className="mt-2 space-y-1 text-[14px]">
            {LANDING_PHONE_CONTACTS.map((phone) => (
              <li key={phone.display}>
                <LandingExternalLink
                  href={phone.waUrl}
                  className="text-brand-text-muted transition-colors hover:text-brand-gold"
                >
                  {phone.display}
                </LandingExternalLink>
              </li>
            ))}
          </ul>
          <LandingWhatsAppButton className="mt-5 w-full">{hero.whatsappCta}</LandingWhatsAppButton>
        </article>

        <article className="rounded-2xl border border-brand-border bg-brand-card p-6">
          <h3 className="font-heading text-xl text-brand-text">{contact.wechatLabel}</h3>
          <p className="mt-2 text-[14px] text-brand-text-muted">{contact.wechatScanHint}</p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Image
              src={LANDING_WECHAT_QR_PATH}
              alt={`WeChat ${LANDING_WECHAT_ID}`}
              width={148}
              height={148}
              className="rounded-xl border border-brand-border bg-white p-2"
            />
            <div className="text-center sm:text-left">
              <p className="font-medium text-brand-text">{LANDING_WECHAT_ID}</p>
              <button
                type="button"
                onClick={copyWeChatId}
                className="mt-3 rounded-lg border border-brand-border px-4 py-2 text-[13px] text-brand-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-text"
              >
                {copied ? contact.wechatCopied : contact.wechatCopy}
              </button>
            </div>
          </div>
        </article>
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
