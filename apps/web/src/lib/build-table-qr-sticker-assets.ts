import { PRODUCT_NAME } from '@mesa/shared';
import { composeTableQrPng } from '@/lib/compose-table-qr-png';
import { ensureTableQrCodes } from '@/lib/table-menu-qr';
import { resolveTableQrStickerScanCta, type TableQrStickerLocale } from '@/lib/table-qr-sticker-copy';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export type BuildTableQrStickerAssetsInput = {
  slug: string;
  webOrigin: string;
  rows: RestaurantTableRow[];
  restaurantName: string;
  /** Dashboard UI language — preview / print / ZIP share this one locale. */
  uiLocale?: TableQrStickerLocale | null;
  resolveDisplayName?: (row: RestaurantTableRow) => string;
};

export async function buildTableQrStickerAssets(input: BuildTableQrStickerAssetsInput): Promise<Record<string, string>> {
  const {
    slug,
    webOrigin,
    rows,
    restaurantName,
    uiLocale,
    resolveDisplayName,
  } = input;
  if (rows.length === 0) return {};
  const scanCta = resolveTableQrStickerScanCta(uiLocale);

  const qrCodes = await ensureTableQrCodes(
    slug,
    rows.map((row) => row.id),
    webOrigin,
  );

  const entries = await Promise.all(
    rows.map(async (row) => {
      const qrDataUrl = qrCodes[row.id];
      if (!qrDataUrl) return null;
      const displayName = resolveDisplayName?.(row) ?? row.display_name;
      const stickerDataUrl = await composeTableQrPng({
        displayName,
        restaurantName,
        productName: PRODUCT_NAME,
        scanCta,
        qrDataUrl,
      });
      return [row.id, stickerDataUrl] as const;
    }),
  );

  return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry !== null));
}
