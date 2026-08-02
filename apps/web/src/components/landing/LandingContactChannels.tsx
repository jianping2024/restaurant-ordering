'use client';

import { useState } from 'react';
import Image from 'next/image';
import { LandingExternalLink } from '@/components/landing/LandingPrimitives';
import {
  LANDING_WECHAT_CONTACTS,
  LANDING_WHATSAPP_CONTACTS,
  type LandingWeChatContact,
} from '@/lib/landing/contact';

const CHANNEL_ACTION_CLASS =
  'flex items-center justify-between gap-3 rounded-xl border border-brand-border px-4 py-3 text-[15px] transition-colors hover:border-brand-gold/40 hover:bg-brand-gold/5';

const COPY_BUTTON_CLASS =
  'rounded-lg border border-brand-border px-4 py-2 text-[13px] text-brand-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-text';

export type LandingContactChannelLabels = {
  whatsappLabel: string;
  wechatLabel: string;
  wechatScanHint: string;
  wechatCopy: string;
  wechatCopied: string;
};

type WeChatContactRowProps = {
  contact: LandingWeChatContact;
  wechatLabel: string;
  wechatCopy: string;
  wechatCopied: string;
};

function WeChatContactRow({ contact, wechatLabel, wechatCopy, wechatCopied }: WeChatContactRowProps) {
  const [copied, setCopied] = useState(false);

  const copyWeChatId = async () => {
    if (!contact.id) return;
    try {
      await navigator.clipboard.writeText(contact.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const altText = contact.id
    ? `${wechatLabel} ${contact.display} (${contact.id})`
    : `${wechatLabel} ${contact.display}`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Image
        src={contact.qrPath}
        alt={altText}
        width={96}
        height={96}
        className="mx-auto flex-shrink-0 rounded-xl border border-brand-border bg-white p-1.5 sm:mx-0"
      />
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="font-medium text-brand-text">{contact.display}</p>
        {contact.hint ? (
          <p className="mt-0.5 text-[13px] text-brand-text-muted">{contact.hint}</p>
        ) : null}
        {contact.id ? (
          <button type="button" onClick={copyWeChatId} className={`mt-3 ${COPY_BUTTON_CLASS}`}>
            {copied ? wechatCopied : wechatCopy}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Sole WhatsApp + WeChat channel list — landing page and store renew modal. */
export function LandingContactChannels({ labels }: { labels: LandingContactChannelLabels }) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-card">
      <div className="p-5 sm:p-6">
        <p className="text-[12px] font-medium uppercase tracking-wider text-brand-gold">
          {labels.whatsappLabel}
        </p>
        <ul className="mt-3 space-y-2">
          {LANDING_WHATSAPP_CONTACTS.map((line) => (
            <li key={line.display}>
              <LandingExternalLink href={line.waUrl} className={CHANNEL_ACTION_CLASS}>
                <span className="min-w-0 text-left">
                  <span className="block font-medium text-brand-text">{line.display}</span>
                  {line.hint ? (
                    <span className="mt-0.5 block text-[13px] text-brand-text-muted">{line.hint}</span>
                  ) : null}
                </span>
                <span aria-hidden className="flex-shrink-0 text-brand-text-muted">
                  ↗
                </span>
              </LandingExternalLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-brand-border" />

      <div className="p-5 sm:p-6">
        <p className="text-[12px] font-medium uppercase tracking-wider text-brand-gold">
          {labels.wechatLabel}
        </p>
        <p className="mt-1 text-[13px] text-brand-text-muted">{labels.wechatScanHint}</p>
        <ul className="mt-4 divide-y divide-brand-border">
          {LANDING_WECHAT_CONTACTS.map((line) => (
            <li key={line.key} className="first:pt-0 last:pb-0 py-4">
              <WeChatContactRow
                contact={line}
                wechatLabel={labels.wechatLabel}
                wechatCopy={labels.wechatCopy}
                wechatCopied={labels.wechatCopied}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
