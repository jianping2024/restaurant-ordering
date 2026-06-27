import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

/** Stable split-person key persisted for whole-table checkout (locale-neutral). */
export const WHOLE_TABLE_PAYER_KEY = '__whole_table__';

/** Legacy label written before i18n — still recognized for display and receipts. */
export const LEGACY_WHOLE_TABLE_PAYER_LABEL = '整桌';

export function isWholeTablePayerName(name: string | null | undefined): boolean {
  const trimmed = (name ?? '').trim();
  return trimmed === WHOLE_TABLE_PAYER_KEY || trimmed === LEGACY_WHOLE_TABLE_PAYER_LABEL;
}

export function uiLangFromPrintLocale(printLocale: string | null | undefined): UILanguage {
  const normalized = (printLocale || 'pt').toLowerCase();
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('en')) return 'en';
  return 'pt';
}

export function wholeTableLabelForLang(lang: UILanguage): string {
  return getMessages(lang).bill.wholeTable;
}

/** Map stored split-person names to the active UI language. */
export function localizeSplitPersonName(
  name: string | null | undefined,
  lang: UILanguage,
): string {
  const trimmed = (name ?? '').trim();
  if (isWholeTablePayerName(trimmed)) {
    return wholeTableLabelForLang(lang);
  }
  return trimmed;
}
