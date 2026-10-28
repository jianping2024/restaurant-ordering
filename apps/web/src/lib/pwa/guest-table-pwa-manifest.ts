import { parseTableIdParam } from '@/lib/restaurant-tables';

/**
 * Guest per-table install manifest HTTP path (query: slug + table_id).
 * Sole path — middleware bypass and menu metadata both use this constant.
 * Lives here (not in site-manifest) so client shell SW → site-manifest stays
 * free of guest-table / middleware coupling.
 */
export const PWA_GUEST_TABLE_MANIFEST_PATH = '/mesa-pwa-guest-table.webmanifest';

/**
 * Sole guest menu start_url for a table iPad install.
 * Always `/{slug}/menu?table_id=…` — never staff `from` / `return` query.
 * Server-only callers (menu metadata + guest manifest route).
 */
export function guestTableMenuStartUrl(slug: string, tableId: string): string | null {
  const cleanSlug = slug.trim();
  const id = parseTableIdParam(tableId);
  if (!cleanSlug || !id) return null;
  return `/${encodeURIComponent(cleanSlug)}/menu?table_id=${encodeURIComponent(id)}`;
}

/** Href for `<link rel="manifest">` on the guest menu page (slug + table_id query). */
export function guestTableManifestHref(slug: string, tableId: string): string | null {
  const cleanSlug = slug.trim();
  const id = parseTableIdParam(tableId);
  if (!cleanSlug || !id) return null;
  const q = new URLSearchParams({ slug: cleanSlug, table_id: id });
  return `${PWA_GUEST_TABLE_MANIFEST_PATH}?${q.toString()}`;
}
