import { headers } from 'next/headers';

/** Public site origin for absolute links (set NEXT_PUBLIC_BASE_URL in production). */
export function getSiteOrigin(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (base) return base.replace(/\/$/, '');

  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!host) return '';

  const proto = h.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
