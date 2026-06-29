import type { UILanguage } from '@/lib/i18n';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';

/** Align dashboard “today” display with restaurant ops timezone. */
export const DASHBOARD_DISPLAY_TZ = 'Europe/Lisbon';

const OVERVIEW_DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
  timeZone: DASHBOARD_DISPLAY_TZ,
};

const ORDER_TIME_OPTS: Intl.DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: DASHBOARD_DISPLAY_TZ,
};

const COLLECTED_TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: DASHBOARD_DISPLAY_TZ,
};

function dashboardCalendarDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: DASHBOARD_DISPLAY_TZ,
  }).format(date);
}

/** Same-day collections show time only; older rows include date for multi-day sessions. */
export function formatCollectedPaymentTime(
  lang: UILanguage,
  iso: string,
  now = new Date(),
): string {
  const locale = UI_LOCALE_BY_LANG[lang];
  const at = new Date(iso);
  const opts =
    dashboardCalendarDay(at) === dashboardCalendarDay(now)
      ? COLLECTED_TIME_OPTS
      : ORDER_TIME_OPTS;
  return new Intl.DateTimeFormat(locale, opts).format(at);
}

/** Stable zh overview line (Node vs mobile ICU differ on spacing around weekday). */
export function formatOverviewDate(lang: UILanguage, date = new Date()): string {
  const locale = UI_LOCALE_BY_LANG[lang];
  if (lang === 'zh') {
    const parts = new Intl.DateTimeFormat(locale, OVERVIEW_DATE_OPTS).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    return `${year}年${month}${day}日 ${weekday}`;
  }
  return new Intl.DateTimeFormat(locale, OVERVIEW_DATE_OPTS).format(date);
}

export function formatOrderDateTime(lang: UILanguage, iso: string): string {
  const locale = UI_LOCALE_BY_LANG[lang];
  return new Intl.DateTimeFormat(locale, ORDER_TIME_OPTS).format(new Date(iso));
}
