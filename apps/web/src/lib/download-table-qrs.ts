import JSZip from 'jszip';
import { tableQrDownloadFilename } from '@/lib/table-menu-qr';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('invalid_data_url');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadTableQrsZip(
  rows: RestaurantTableRow[],
  stickerDataUrls: Record<string, string>,
  zipFilename: string,
  resolveDisplayName?: (row: RestaurantTableRow) => string,
): Promise<number> {
  const zip = new JSZip();
  let count = 0;
  for (const row of rows) {
    const dataUrl = stickerDataUrls[row.id];
    if (!dataUrl) continue;
    const displayName = resolveDisplayName?.(row) ?? row.display_name;
    zip.file(tableQrDownloadFilename(displayName), dataUrlToUint8Array(dataUrl));
    count += 1;
  }
  if (count === 0) return 0;
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(blob, zipFilename);
  return count;
}
