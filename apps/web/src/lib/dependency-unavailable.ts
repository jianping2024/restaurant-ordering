/**
 * Single representation for upstream Auth/DB/transport failures (e.g. Cloudflare 525).
 * Business deny codes (invalid_credentials, wrong_context, …) stay separate.
 */

export const DEPENDENCY_UNAVAILABLE = 'dependency_unavailable' as const;

export type DependencyUnavailableCode = typeof DEPENDENCY_UNAVAILABLE;

const DEPENDENCY_MESSAGE_MARKERS = [
  '525',
  'ssl handshake',
  'fetch failed',
  'failed to fetch',
  'failed to get project config',
  'econnreset',
  'etimedout',
  'enotfound',
  'networkerror',
  'socket hang up',
  'cloudflare',
] as const;

export function isDependencyUnavailableCode(code: string | null | undefined): boolean {
  return code === DEPENDENCY_UNAVAILABLE;
}

/** Classify thrown values / Auth API errors / PostgREST messages. */
export function isDependencyFailure(err: unknown): boolean {
  if (err == null) return false;

  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  }

  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
    if (err.name === 'TypeError' && /fetch/i.test(err.message)) return true;
    if (messageLooksLikeDependencyFailure(err.message)) return true;
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause && cause !== err && isDependencyFailure(cause)) return true;
  }

  if (typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    if (typeof rec.message === 'string' && messageLooksLikeDependencyFailure(rec.message)) {
      return true;
    }
    if (typeof rec.status === 'number' && (rec.status === 502 || rec.status === 503 || rec.status === 504)) {
      return true;
    }
  }

  if (typeof err === 'string' && messageLooksLikeDependencyFailure(err)) return true;

  return false;
}

export function messageLooksLikeDependencyFailure(message: string): boolean {
  const lower = message.toLowerCase();
  if (DEPENDENCY_MESSAGE_MARKERS.some((m) => lower.includes(m))) return true;
  // Cloudflare/HTML error bodies returned as PostgREST error.message
  if (lower.includes('<!doctype html') && lower.includes('supabase')) return true;
  return false;
}

/** Default client timeout for login / open-table against flaky gateways. */
export const DEPENDENCY_FETCH_TIMEOUT_MS = 15_000;

export async function fetchWithDependencyTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEPENDENCY_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (isDependencyFailure(err)) {
      const wrapped = new Error(DEPENDENCY_UNAVAILABLE) as Error & {
        code: DependencyUnavailableCode;
      };
      wrapped.code = DEPENDENCY_UNAVAILABLE;
      wrapped.cause = err;
      throw wrapped;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
