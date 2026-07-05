import { composeTableQrPng } from '@/lib/compose-table-qr-png';
import { ensureTableQrCodes } from '@/lib/table-menu-qr';
import { resolveTableQrGroupLabel } from '@/lib/table-qr-card-layout';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export type BuildTableQrStickerAssetsInput = {
  slug: string;
  rows: RestaurantTableRow[];
  groupNameByTableId: Record<string, string>;
  restaurantName: string;
  ungroupedLabel: string;
  resolveDisplayName?: (row: RestaurantTableRow) => string;
};

export async function buildTableQrStickerAssets(
  input: BuildTableQrStickerAssetsInput,
): Promise<Record<string, string>> {
  const { slug, rows, groupNameByTableId, restaurantName, ungroupedLabel, resolveDisplayName } =
    input;
  if (rows.length === 0) return {};

  const qrCodes = await ensureTableQrCodes(
    slug,
    rows.map((row) => row.id),
  );

  const entries = await Promise.all(
    rows.map(async (row) => {
      const qrDataUrl = qrCodes[row.id];
      if (!qrDataUrl) return null;
      const displayName = resolveDisplayName?.(row) ?? row.display_name;
      const stickerDataUrl = await composeTableQrPng({
        displayName,
        groupName: resolveTableQrGroupLabel(row.id, groupNameByTableId, ungroupedLabel),
        restaurantName,
        qrDataUrl,
      });
      return [row.id, stickerDataUrl] as const;
    }),
  );

  return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry !== null));
}
