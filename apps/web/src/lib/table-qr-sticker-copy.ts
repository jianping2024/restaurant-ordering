import { getMessages } from './i18n/messages';

export type TableQrStickerLocale = 'zh' | 'en' | 'pt';

export function resolveTableQrStickerLocale(
  locale: TableQrStickerLocale | null | undefined,
): TableQrStickerLocale {
  return locale === 'zh' || locale === 'en' || locale === 'pt' ? locale : 'pt';
}

export function resolveTableQrStickerScanCta(
  locale: TableQrStickerLocale | null | undefined,
): string {
  return getMessages(resolveTableQrStickerLocale(locale)).tables.stickerScanCta;
}
