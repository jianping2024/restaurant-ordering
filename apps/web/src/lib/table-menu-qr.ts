import { getPublicWebOrigin } from '@/lib/site-origin';

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
let staffLoginQrCache: { key: string; dataUrl: string } | null = null;

function resolveOrigin(origin?: string): string {
  return (origin?.replace(/\/$/, '') || getPublicWebOrigin());
}

export function buildTableMenuQrUrl(slug: string, tableId: string, origin?: string): string {
  return `${resolveOrigin(origin)}/${slug}/menu?table_id=${encodeURIComponent(tableId)}`;
}

export function buildStaffLoginQrUrl(slug: string, origin?: string): string {
  return `${resolveOrigin(origin)}/${slug}/staff/login`;
}

export function tableQrDownloadFilename(displayName: string): string {
  const safe = displayName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'table';
  return `table-${safe}-qr.png`;
}

function tableQrCacheKey(tableId: string, origin: string): string {
  return `${origin}|${tableId}`;
}

async function loadQrEncoder() {
  const { default: QRCode } = await import('qrcode');
  return QRCode;
}

export async function generateTableQrDataUrl(
  slug: string,
  tableId: string,
  origin?: string,
): Promise<string> {
  const base = resolveOrigin(origin);
  const key = tableQrCacheKey(tableId, base);
  const cached = tableQrCache.get(key);
  if (cached) return cached;

  const QRCode = await loadQrEncoder();
  const dataUrl = await QRCode.toDataURL(buildTableMenuQrUrl(slug, tableId, base), TABLE_QR_OPTIONS);
  tableQrCache.set(key, dataUrl);
  return dataUrl;
}

export function removeTableQrCache(tableId: string): void {
  const suffix = `|${tableId}`;
  for (const key of Array.from(tableQrCache.keys())) {
    if (key.endsWith(suffix)) tableQrCache.delete(key);
  }
}

export async function ensureTableQrCodes(
  slug: string,
  tableIds: string[],
  origin?: string,
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    tableIds.map(
      async (tableId) => [tableId, await generateTableQrDataUrl(slug, tableId, origin)] as const,
    ),
  );
  return Object.fromEntries(entries);
}

export async function generateStaffLoginQrDataUrl(slug: string, origin?: string): Promise<string> {
  const base = resolveOrigin(origin);
  const key = `${base}|${slug}`;
  if (staffLoginQrCache?.key === key) return staffLoginQrCache.dataUrl;

  const QRCode = await loadQrEncoder();
  const dataUrl = await QRCode.toDataURL(buildStaffLoginQrUrl(slug, base), STAFF_LOGIN_QR_OPTIONS);
  staffLoginQrCache = { key, dataUrl };
  return dataUrl;
}
