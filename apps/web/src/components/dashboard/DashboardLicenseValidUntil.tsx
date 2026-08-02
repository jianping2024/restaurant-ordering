'use client';

import { useState } from 'react';
import { LandingContactChannels } from '@/components/landing/LandingContactChannels';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Modal } from '@/components/ui/Modal';
import { getLandingCopy } from '@/lib/landing/copy';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import {
  LICENSE_VALID_UNTIL_URGENCY_CLASS,
  formatLicenseValidUntilYmd,
  resolveLicenseValidUntilDisplay,
} from '@/lib/license-valid-until-display';

type Props = {
  licenseValidUntil: string | null | undefined;
};

/** Sole dashboard chrome for restaurant license clock + renew contact. */
export function DashboardLicenseValidUntil({ licenseValidUntil }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).licenseExpiry;
  const contact = getLandingCopy(lang).contact;
  const [open, setOpen] = useState(false);

  const display = resolveLicenseValidUntilDisplay(licenseValidUntil);
  if (!display) return null;

  const dateStr = formatLicenseValidUntilYmd(display.ymd, UI_LOCALE_BY_LANG[lang]);
  const label = t.label.replace('{date}', dateStr);
  const urgencyClass = LICENSE_VALID_UNTIL_URGENCY_CLASS[display.urgency];

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex max-w-[10rem] items-center truncate whitespace-nowrap px-1.5 text-[11px] leading-none sm:max-w-[13rem] sm:text-[13px] ${urgencyClass}`}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.contactTitle} size="md">
        <div className="p-4 sm:p-6">
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
      </Modal>
    </div>
  );
}
