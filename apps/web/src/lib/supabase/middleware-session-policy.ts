/**
 * Sole middleware session-bypass policy.
 * Matcher negative-lookahead and updateSession early-return both use this module —
 * do not add a second skip list in middleware.ts.
 *
 * Restaurant customer + staff APIs authenticate in the route handler (session /
 * staffSessionForSlug). Skipping Edge getUser here removes a duplicate Auth RTT;
 * cookie refresh still runs on /dashboard and other non-bypassed navigations.
 */

const SESSION_BYPASS_PREFIXES = [
  '/api/print-agent',
  '/api/cron',
  '/api/health',
  '/api/downloads',
] as const;

/**
 * Full-pathname regex sources (leading `/`).
 * Matcher alts are derived via {@link pathnameBypassSourceToMatcherAlt} — one list only.
 *
 * One pattern for tenant restaurant APIs that own auth in the handler
 * (`customer` | `staff`). Do not split into parallel customer-only / staff-only lists.
 */
const SESSION_BYPASS_PATHNAME_REGEX_SOURCES = [
  '^/api/restaurants/[^/]+/(?:customer|staff)(?:/|$)',
] as const;

const SESSION_BYPASS_PATHNAME_REGEXES = SESSION_BYPASS_PATHNAME_REGEX_SOURCES.map(
  (source) => new RegExp(source),
);

/** Turn a pathname regex source into a Next.js matcher negative-lookahead alternative. */
export function pathnameBypassSourceToMatcherAlt(source: string): string {
  return source.replace(/^\^?\//, '').replace(/\(\?:\/\|\$\)$/, '(?:/.*)?');
}

export function shouldBypassMiddlewareSession(pathname: string): boolean {
  for (const prefix of SESSION_BYPASS_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  return SESSION_BYPASS_PATHNAME_REGEXES.some((re) => re.test(pathname));
}

/**
 * Next.js `config.matcher` entries — derived from the same bypass prefixes/patterns
 * as {@link shouldBypassMiddlewareSession}.
 */
export function buildMiddlewareMatcher(): string[] {
  const apiPrefixAlts = SESSION_BYPASS_PREFIXES.map((prefix) => {
    const bare = prefix.replace(/^\//, '');
    return `${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/.*)?`;
  });
  const pathAlts = SESSION_BYPASS_PATHNAME_REGEX_SOURCES.map(pathnameBypassSourceToMatcherAlt);
  const negative = [
    '_next/static',
    '_next/image',
    'favicon\\.ico',
    'manifest\\.webmanifest',
    ...apiPrefixAlts,
    ...pathAlts,
    '.*\\.(?:svg|png|jpg|jpeg|gif|webp)$',
  ].join('|');
  return [`/((?!${negative}).*)`];
}

export function isInvalidRefreshTokenError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === 'refresh_token_not_found') return true;
  const msg = (error.message ?? '').toLowerCase();
  return msg.includes('refresh token') && (msg.includes('not found') || msg.includes('invalid'));
}
