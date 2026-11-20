/**
 * Sole gate: page build (`getWebAppBuildInfo`) must match `/api/health/live.version`.
 * Mismatch → one reload. Health unreachable / empty versions → no reload.
 */

export const WEB_APP_LIVE_HEALTH_PATH = '/api/health/live';

/** sessionStorage: last attempted `pageVersion→liveVersion` reload (loop guard). */
export const WEB_APP_BUILD_RELOAD_ATTEMPT_KEY = 'mesa:web-app-build-reload-attempt';

export function parseLiveHealthVersion(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const version = (body as { version?: unknown }).version;
  if (typeof version !== 'string') return null;
  const trimmed = version.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Whether the page build and live health disagree enough to force a reload.
 * Either side empty → false (local `next dev` often has empty MESA_WEB_VERSION).
 */
export function webAppBuildMismatch(
  pageVersion: string | null | undefined,
  liveVersion: string | null | undefined,
): boolean {
  const page = pageVersion?.trim() ?? '';
  const live = liveVersion?.trim() ?? '';
  if (!page || !live) return false;
  return page !== live;
}

function attemptToken(pageVersion: string, liveVersion: string): string {
  return `${pageVersion.trim()}→${liveVersion.trim()}`;
}

/**
 * Decide whether to reload now. When true, records the attempt so the same
 * page→live pair cannot loop if the document is still stale after reload.
 * Clears the attempt marker when versions already match.
 */
export function takeWebAppBuildReloadDecision(
  pageVersion: string | null | undefined,
  liveVersion: string | null | undefined,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
): { reload: true; pageVersion: string; liveVersion: string } | { reload: false } {
  if (!webAppBuildMismatch(pageVersion, liveVersion)) {
    try {
      storage?.removeItem(WEB_APP_BUILD_RELOAD_ATTEMPT_KEY);
    } catch {
      /* private mode */
    }
    return { reload: false };
  }
  const page = pageVersion!.trim();
  const live = liveVersion!.trim();
  const token = attemptToken(page, live);
  try {
    if (storage?.getItem(WEB_APP_BUILD_RELOAD_ATTEMPT_KEY) === token) {
      return { reload: false };
    }
    storage?.setItem(WEB_APP_BUILD_RELOAD_ATTEMPT_KEY, token);
  } catch {
    /* still reload once this session turn */
  }
  return { reload: true, pageVersion: page, liveVersion: live };
}

export async function fetchLiveHealthVersion(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(WEB_APP_LIVE_HEALTH_PATH, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body: unknown = await res.json().catch(() => null);
    return parseLiveHealthVersion(body);
  } catch {
    return null;
  }
}
