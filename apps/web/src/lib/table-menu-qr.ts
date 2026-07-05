const TABLE_QR_OPTIONS = {
  width: 200,
  margin: 2,
  color: { dark: '#0f0e0c', light: '#f5f0e8' },
} as const;

const STAFF_LOGIN_QR_OPTIONS = {
  width: 220,
  margin: 2,
  color: { dark: '#0f0e0c', light: '#f5f0e8' },
} as const;

const tableQrCache = new Map<string, string>();
let staffLoginQrCache: { slug: string; dataUrl: string } | null = null;

export function getTableMenuBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

export function buildTableMenuQrUrl(slug: string, tableId: string): string {
  return `${getTableMenuBaseUrl()}/${slug}/menu?table_id=${encodeURIComponent(tableId)}`;
}

export function buildStaffLoginQrUrl(slug: string): string {
  return `${getTableMenuBaseUrl()}/${slug}/staff/login`;
}

export function tableQrDownloadFilename(displayName: string): string {
  const safe = displayName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'table';
  return `table-${safe}-qr.png`;
}

async function loadQrEncoder() {
  const { default: QRCode } = await import('qrcode');
  return QRCode;
}

export async function generateTableQrDataUrl(slug: string, tableId: string): Promise<string> {
  const cached = tableQrCache.get(tableId);
  if (cached) return cached;

  const QRCode = await loadQrEncoder();
  const dataUrl = await QRCode.toDataURL(buildTableMenuQrUrl(slug, tableId), TABLE_QR_OPTIONS);
  tableQrCache.set(tableId, dataUrl);
  return dataUrl;
}

export function removeTableQrCache(tableId: string): void {
  tableQrCache.delete(tableId);
}

export async function ensureTableQrCodes(
  slug: string,
  tableIds: string[],
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    tableIds.map(async (tableId) => [tableId, await generateTableQrDataUrl(slug, tableId)] as const),
  );
  return Object.fromEntries(entries);
}

export async function generateStaffLoginQrDataUrl(slug: string): Promise<string> {
  if (staffLoginQrCache?.slug === slug) return staffLoginQrCache.dataUrl;

  const QRCode = await loadQrEncoder();
  const dataUrl = await QRCode.toDataURL(buildStaffLoginQrUrl(slug), STAFF_LOGIN_QR_OPTIONS);
  staffLoginQrCache = { slug, dataUrl };
  return dataUrl;
}
