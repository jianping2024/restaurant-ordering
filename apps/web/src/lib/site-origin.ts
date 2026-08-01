type HeaderReader = { get(name: string): string | null };

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, '');
}

function originFromHeaders(requestHeaders: HeaderReader): string | null {
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
  if (!host) return null;
  const proto =
    requestHeaders.get('x-forwarded-proto') ||
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
 * Mode B print-agent claim Realtime edge: `getPrintAgentClaimSupabaseUrl` reuses this
 * (same-origin edge = the host the agent used for claim).
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
