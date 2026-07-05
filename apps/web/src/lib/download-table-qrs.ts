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

export function downloadTableQr(dataUrl: string, displayName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = tableQrDownloadFilename(displayName);
  link.click();
}

export async function downloadTableQrsZip(
  rows: RestaurantTableRow[],
  qrCodes: Record<string, string>,
  zipFilename: string,
): Promise<number> {
  const zip = new JSZip();
  let count = 0;
  for (const row of rows) {
    const dataUrl = qrCodes[row.id];
    if (!dataUrl) continue;
    zip.file(tableQrDownloadFilename(row.display_name), dataUrlToUint8Array(dataUrl));
    count += 1;
  }
  if (count === 0) return 0;
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(blob, zipFilename);
  return count;
}
