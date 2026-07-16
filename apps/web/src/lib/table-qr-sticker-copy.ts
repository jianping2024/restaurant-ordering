export type TableQrStickerLocale = 'zh' | 'en' | 'pt';

const TABLE_QR_SCAN_CTA: Record<TableQrStickerLocale, string> = {
  zh: '扫码开始点餐 ›',
  en: 'Scan to Order ›',
  pt: 'Digitalize para pedir ›',
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
