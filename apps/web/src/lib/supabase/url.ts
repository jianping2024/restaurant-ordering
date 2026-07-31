/**
 * Single resolver for Supabase API base URL (Auth / REST / Realtime / Storage).
 *
 * - Browser + Mode B same-origin (`NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`): `window.location.origin`
 * - Browser + cloud / local CLI: `NEXT_PUBLIC_SUPABASE_URL`
 * - Server: `SUPABASE_URL` (e.g. http://kong:8000) then `NEXT_PUBLIC_SUPABASE_URL`
 *
 * Do not read these env vars at call sites for client construction — use this function only.
 */
export function getSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    if (isSupabaseBrowserSameOrigin()) {
      return window.location.origin;
    }
    const pub = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!pub) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    }
    return pub;
  }

  const internal = process.env.SUPABASE_URL?.trim();
  if (internal) return internal;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!pub) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set');
  }
  return pub;
}

/**
 * URL for external clients (print-agent Realtime/Auth). Never docker-internal (`kong`).
 * Mode B: `SUPABASE_PUBLIC_URL` = edge origin. Cloud: `NEXT_PUBLIC_SUPABASE_URL` project URL.
 */
export function getPublishedSupabaseUrl(): string {
  const published = process.env.SUPABASE_PUBLIC_URL?.trim();
  if (published) return published;
  const nextPub = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (nextPub) return nextPub;
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (base) return base;
  if (typeof window !== 'undefined') return window.location.origin;
  throw new Error('SUPABASE_PUBLIC_URL or NEXT_PUBLIC_SUPABASE_URL must be set');
}

/**
 * Mode B edge gateway only. Not the same as MESA_ON_PREM (local CLI can set
 * MESA_ON_PREM for license UAT while still using supabase start :54321).
 */
export function isSupabaseBrowserSameOrigin(): boolean {
  const v = (process.env.NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN || '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
