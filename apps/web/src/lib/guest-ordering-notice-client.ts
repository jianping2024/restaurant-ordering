import {
  normalizeGuestOrderingNotice,
  type GuestOrderingNotice,
} from '@/lib/guest-ordering-notice';

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
 * One-shot entry reconcile — keeps SSR seed on failure, no polling.
 */
export function reconcileGuestOrderingNoticeOnEntry(params: {
  slug: string;
  seed?: GuestOrderingNotice | null;
}): Promise<GuestOrderingNotice> {
  return fetchGuestOrderingNoticeFromApi(params.slug).catch(() =>
    normalizeGuestOrderingNotice(params.seed),
  );
}
