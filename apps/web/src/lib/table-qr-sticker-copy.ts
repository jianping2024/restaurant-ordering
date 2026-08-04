import type { UILanguage } from '@/lib/i18n';

/** Sticker CTA locale — same set as dashboard UI language. */
export type TableQrStickerLocale = UILanguage;

/** One CTA map — native restaurant short prompts (sticker face). */
const TABLE_QR_SCAN_CTA: Record<TableQrStickerLocale, string> = {
  zh: '点餐 ›',
  en: 'Order ›',
  pt: 'Peça já ›',
  es: 'Pida ya ›',
  fr: 'Commandez ›',
  de: 'Jetzt bestellen ›',
};

export function resolveTableQrStickerLocale(
  locale: TableQrStickerLocale | null | undefined,
): TableQrStickerLocale {
  return locale && locale in TABLE_QR_SCAN_CTA ? locale : 'pt';
}

export function resolveTableQrStickerScanCta(
  locale: TableQrStickerLocale | null | undefined,
): string {
  return TABLE_QR_SCAN_CTA[resolveTableQrStickerLocale(locale)];
}
