import type { UILanguage } from '@/lib/i18n';

/** Sticker CTA locale — same set as dashboard UI language. */
export type TableQrStickerLocale = UILanguage;

const TABLE_QR_SCAN_CTA: Record<TableQrStickerLocale, string> = {
  zh: '点餐 ›',
  en: 'Order ›',
  pt: 'Pedir ›',
};

export function resolveTableQrStickerLocale(
  locale: TableQrStickerLocale | null | undefined,
): TableQrStickerLocale {
  return locale === 'zh' || locale === 'en' || locale === 'pt' ? locale : 'pt';
}

export function resolveTableQrStickerScanCta(
  locale: TableQrStickerLocale | null | undefined,
): string {
  return TABLE_QR_SCAN_CTA[resolveTableQrStickerLocale(locale)];
}
