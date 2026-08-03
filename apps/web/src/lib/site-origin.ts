type HeaderReader = { get(name: string): string | null };

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, '');
}

/** Origin of an absolute http(s) URL, or null if not usable. */
export function originFromAbsoluteHttpUrl(raw: string | null | undefined): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return normalizeOrigin(u.origin);
  } catch {
    return null;
  }
}

function originFromHeaders(requestHeaders: HeaderReader): string | null {
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
  if (!host) return null;
  // Tunnel→Caddy is often plain HTTP, so X-Forwarded-Proto may be "http" even when
  // the client used https://. Prefer the left-most proto if a chain is present.
  const forwarded = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto =
    forwarded ||
    (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return normalizeOrigin(`${proto}://${host}`);
}

/** Browser page origin without `typeof window` (Next DCE turns that into `false` on SSR compiles). */
function originFromBrowserLocation(): string | null {
  try {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin;
    if (origin) return normalizeOrigin(origin);
  } catch {
    /* non-DOM runtime */
  }
  return null;
}

/**
 * Public Mesa web origin for absolute same-site links (menu/staff QR, downloads, pairing).
 *
 * Priority:
 * 1. Request headers (pass `headers()` from Server Components — dual-entry Host wins)
 * 2. Browser `location.origin` (LAN vs domain follows how the page was opened)
 * 3. `NEXT_PUBLIC_BASE_URL`, then `http://localhost:3000`
 *
 * Not for cloud Supabase project URL — use `getSupabaseUrl()` / `getPublishedSupabaseUrl()`.
 * Mode B print-agent claim may fall back to this helper when `api_base` is missing;
 * cloud claim never uses app Host as Realtime (see `resolvePrintAgentClaimSupabaseUrl`).
 */
export function getPublicWebOrigin(requestHeaders?: HeaderReader): string {
  if (requestHeaders) {
    const fromHeaders = originFromHeaders(requestHeaders);
    if (fromHeaders) return fromHeaders;
  }

  const fromBrowser = originFromBrowserLocation();
  if (fromBrowser) return fromBrowser;

  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (base) return normalizeOrigin(base);
  return 'http://localhost:3000';
}
