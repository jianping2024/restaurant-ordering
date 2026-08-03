import {
  normalizeGuestOrderingNotice,
  type GuestOrderingNotice,
} from '@/lib/guest-ordering-notice';

/** Client memory TTL for guest notice; HTTP remains `CUSTOMER_READ_NO_STORE_HEADERS`. */
const NOTICE_TTL_MS = 60_000;

type NoticeEntry = {
  fetchedAt: number;
  notice: GuestOrderingNotice;
};

const memoryBySlug = new Map<string, NoticeEntry>();
const inFlightBySlug = new Map<string, Promise<GuestOrderingNotice>>();

function isFresh(entry: NoticeEntry): boolean {
  return Date.now() - entry.fetchedAt < NOTICE_TTL_MS;
}

function peekNotice(slug: string): GuestOrderingNotice | null {
  const entry = memoryBySlug.get(slug);
  if (!entry || !isFresh(entry)) return null;
  return entry.notice;
}

function commitNotice(slug: string, notice: GuestOrderingNotice): GuestOrderingNotice {
  memoryBySlug.set(slug, { fetchedAt: Date.now(), notice });
  return notice;
}

async function fetchGuestOrderingNoticeFromApi(slug: string): Promise<GuestOrderingNotice> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/customer/guest-notice`,
    {
      credentials: 'include',
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error('guest_notice_fetch_failed');
  const data = (await res.json()) as { notice?: unknown };
  return normalizeGuestOrderingNotice(data.notice);
}

/**
 * One-shot entry reconcile — memory TTL first, then one shared GET.
 * Keeps SSR seed on failure; no polling.
 */
export function reconcileGuestOrderingNoticeOnEntry(params: {
  slug: string;
  seed?: GuestOrderingNotice | null;
}): Promise<GuestOrderingNotice> {
  const seed = normalizeGuestOrderingNotice(params.seed);
  if (params.seed) {
    commitNotice(params.slug, seed);
  }

  const cached = peekNotice(params.slug);
  if (cached) return Promise.resolve(cached);

  const running = inFlightBySlug.get(params.slug);
  if (running) return running;

  const promise = fetchGuestOrderingNoticeFromApi(params.slug)
    .then((notice) => commitNotice(params.slug, notice))
    .catch(() => {
      const fallback = peekNotice(params.slug) ?? seed;
      commitNotice(params.slug, fallback);
      return fallback;
    })
    .finally(() => {
      inFlightBySlug.delete(params.slug);
    });

  inFlightBySlug.set(params.slug, promise);
  return promise;
}
