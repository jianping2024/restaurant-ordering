'use client';

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { todayLisbonCalendarDate } from '@mesa/shared';
import { LicenseRenewalContactModal } from '@/components/dashboard/LicenseRenewalContactModal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import {
  markLicenseRenewalDailyPromptSeen,
  resolveLicenseRenewalDailyPromptOffer,
} from '@/lib/license-renewal-daily-prompt';
import {
  LICENSE_VALID_UNTIL_URGENCY_CLASS,
  formatLicenseValidUntilYmd,
  resolveLicenseValidUntilDisplay,
} from '@/lib/license-valid-until-display';
import { STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS } from '@/lib/waiter-staff-sticky-chrome';

export type DashboardLicenseMenuRow = {
  label: string;
  onClick: () => void;
};

type HostApi = {
  /** soon/urgent only — “请联系续费”. */
  trailingStart: ReactNode;
  /** Always when a valid-until clock exists — menu “授权至 {date}”. */
  licenseMenu: DashboardLicenseMenuRow | null;
};

type Props = {
  restaurantId: string;
  licenseValidUntil: string | null | undefined;
  children: (api: HostApi) => ReactNode;
};

type OpenState = {
  mode: 'manual' | 'daily';
  ymd: string;
  daysRemaining: number;
};

/**
 * Sole dashboard host for license renewal chrome: top-bar CTA, account-menu row, daily urgent
 * dialog, and the single contact modal.
 */
export function DashboardLicenseRenewalHost({
  restaurantId,
  licenseValidUntil,
  children,
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).licenseExpiry;
  const [openState, setOpenState] = useState<OpenState | null>(null);
  const [lisbonDay, setLisbonDay] = useState(() => todayLisbonCalendarDate());

  const display = resolveLicenseValidUntilDisplay(licenseValidUntil);
  const dateStr = display
    ? formatLicenseValidUntilYmd(display.ymd, UI_LOCALE_BY_LANG[lang])
    : '';

  const openManual = useCallback(() => {
    const next = resolveLicenseValidUntilDisplay(licenseValidUntil);
    if (!next) return;
    if (next.urgency === 'urgent') {
      markLicenseRenewalDailyPromptSeen(restaurantId, next.ymd);
    }
    setOpenState({
      mode: 'manual',
      ymd: next.ymd,
      daysRemaining: next.daysRemaining,
    });
  }, [licenseValidUntil, restaurantId]);

  const tryOfferDaily = useCallback(() => {
    setOpenState((current) => {
      if (current) return current;
      const offer = resolveLicenseRenewalDailyPromptOffer(restaurantId, licenseValidUntil);
      if (!offer) return null;
      markLicenseRenewalDailyPromptSeen(restaurantId, offer.ymd);
      return {
        mode: 'daily',
        ymd: offer.ymd,
        daysRemaining: offer.daysRemaining,
      };
    });
  }, [licenseValidUntil, restaurantId]);

  useEffect(() => {
    tryOfferDaily();
  }, [tryOfferDaily, lisbonDay]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tryOfferDaily();
    };
    const onFocus = () => tryOfferDaily();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    const tick = window.setInterval(() => {
      const today = todayLisbonCalendarDate();
      setLisbonDay((prev) => (prev === today ? prev : today));
    }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(tick);
    };
  }, [tryOfferDaily]);

  const trailingStart =
    display && display.urgency !== 'normal' ? (
      <div className="flex shrink-0 items-center self-stretch">
        <button
          type="button"
          onClick={openManual}
          className={`inline-flex h-full ${STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS} items-center truncate whitespace-nowrap px-1 text-[11px] leading-none sm:max-w-[13rem] sm:px-1.5 sm:text-[13px] ${LICENSE_VALID_UNTIL_URGENCY_CLASS[display.urgency]}`}
          title={t.topBarCta}
          aria-haspopup="dialog"
          aria-expanded={openState != null}
        >
          {t.topBarCta}
        </button>
      </div>
    ) : null;

  const licenseMenu: DashboardLicenseMenuRow | null = display
    ? {
        label: t.menuLabel.replace('{date}', dateStr),
        onClick: openManual,
      }
    : null;

  const modalDateStr =
    openState != null
      ? formatLicenseValidUntilYmd(openState.ymd, UI_LOCALE_BY_LANG[lang])
      : dateStr;

  return (
    <>
      {children({ trailingStart, licenseMenu })}
      <LicenseRenewalContactModal
        open={openState != null}
        onClose={() => setOpenState(null)}
        mode={openState?.mode ?? 'manual'}
        dateStr={modalDateStr}
        daysRemaining={openState?.daysRemaining ?? display?.daysRemaining ?? 0}
      />
    </>
  );
}
