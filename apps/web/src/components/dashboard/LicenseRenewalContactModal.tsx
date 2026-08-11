'use client';

import { LandingContactChannels } from '@/components/landing/LandingContactChannels';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Modal } from '@/components/ui/Modal';
import { getLandingCopy } from '@/lib/landing/copy';
import { getMessages } from '@/lib/i18n/messages';

export type LicenseRenewalContactMode = 'manual' | 'daily';

type Props = {
  open: boolean;
  onClose: () => void;
  mode: LicenseRenewalContactMode;
  /** Formatted civil end date for copy. */
  dateStr: string;
  daysRemaining: number;
};

/**
 * Sole dashboard renewal-contact dialog — opened from top-bar CTA, account menu, or daily urgent prompt.
 */
export function LicenseRenewalContactModal({
  open,
  onClose,
  mode,
  dateStr,
  daysRemaining,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).licenseExpiry;
  const contact = getLandingCopy(lang).contact;

  const title = mode === 'daily' ? t.dailyTitle : t.contactTitle;
  const body =
    mode === 'daily'
      ? daysRemaining < 0
        ? t.dailyBodyExpired.replace('{date}', dateStr)
        : t.dailyBody
            .replace('{date}', dateStr)
            .replace('{days}', String(Math.max(daysRemaining, 0)))
      : null;

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4 p-4 sm:p-6">
        {body ? <p className="text-sm leading-relaxed text-brand-text">{body}</p> : null}
        <LandingContactChannels
          labels={{
            whatsappLabel: contact.whatsappLabel,
            wechatLabel: contact.wechatLabel,
            wechatScanHint: contact.wechatScanHint,
            wechatCopy: contact.wechatCopy,
            wechatCopied: contact.wechatCopied,
          }}
        />
        {mode === 'daily' ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 text-sm font-medium text-brand-text hover:bg-brand-bg"
          >
            {t.snoozeToday}
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
