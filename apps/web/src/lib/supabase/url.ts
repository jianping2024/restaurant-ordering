import { menuImageSameOriginEnabled } from '@mesa/shared';
import { getPublicWebOrigin, originFromAbsoluteHttpUrl } from '../site-origin';

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
 * Mode B env default: `SUPABASE_PUBLIC_URL` = edge origin. Cloud: `NEXT_PUBLIC_SUPABASE_URL` project URL.
 *
 * Print-agent **claim** must not use this alone on Mode B — see `resolvePrintAgentClaimSupabaseUrl`
 * (agent `api_base` origin first so Realtime scheme cannot diverge from REST).
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

type HeaderReader = { get(name: string): string | null };

/**
 * Sole `supabase_url` for print-agent claim JSON.
 * Prefer the agent’s `api_base` origin (what it used to reach claim) so Realtime scheme
 * cannot diverge from REST when proxies rewrite X-Forwarded-Proto to http.
 * Fallback: Mode B request edge / cloud published URL.
 */
export function resolvePrintAgentClaimSupabaseUrl(
  apiBase: string | null | undefined,
  requestHeaders: HeaderReader,
): string {
  const fromApiBase = originFromAbsoluteHttpUrl(apiBase);
  if (fromApiBase) return fromApiBase;
  if (isSupabaseBrowserSameOrigin()) {
    return getPublicWebOrigin(requestHeaders);
  }
  return getPublishedSupabaseUrl();
}

/**
 * Mode B edge gateway only. Not the same as MESA_ON_PREM (local CLI can set
 * MESA_ON_PREM for license UAT while still using supabase start :54321).
 * Flag parse: `@mesa/shared` `menuImageSameOriginEnabled()` with **no** `process.env`
 * argument so Next inlines `NEXT_PUBLIC_MESA_SUPABASE_SAME_ORIGIN`.
 */
export function isSupabaseBrowserSameOrigin(): boolean {
  return menuImageSameOriginEnabled();
}

/**
 * Hostname of Mode B `SUPABASE_URL` (`http://kong:8000` in compose). Supabase SSR
 * cookie name is `sb-${hostname.split('.')[0]}-auth-token`.
 * Keep in sync with deploy/on-prem `SUPABASE_URL=http://kong:8000`.
 */
const MODE_B_SUPABASE_URL_HOSTNAME = 'kong';

/**
 * Sole auth cookieOptions for Mode B same-origin.
 *
 * Server clients use `SUPABASE_URL` host `kong` → cookie `sb-kong-auth-token`.
 * Browser same-origin uses `window.location.origin` → would mint a different
 * cookie name and miss the session → Realtime joins without JWT → RLS drops CDC.
 * When same-origin is off (cloud / local CLI), return undefined and let
 * `@supabase/ssr` derive the name from the URL as usual.
 */
export function getSupabaseAuthCookieOptions(): { name: string } | undefined {
  if (!isSupabaseBrowserSameOrigin()) return undefined;
  return {
    name: `sb-${MODE_B_SUPABASE_URL_HOSTNAME.split('.')[0]}-auth-token`,
  };
}
