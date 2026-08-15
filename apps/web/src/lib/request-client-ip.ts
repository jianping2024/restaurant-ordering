/**
 * Sole client IP for abuse / rate-limit keys (login, append, claim, feedback, …).
 *
 * Trust order (never prefer leftmost X-Forwarded-For — that is client-spoofable):
 * 1. CF-Connecting-IP (Cloudflare / Tunnel sets the real visitor)
 * 2. Rightmost X-Forwarded-For hop (Caddy appends the immediate peer)
 * 3. X-Real-IP
 * 4. unknown
 */

function parseClientIpToken(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (!s) return null;
  if (s.toLowerCase() === 'unknown') return null;
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (s.includes(':')) {
    // Loose IPv6 — enough for rate-limit map keys; reject junk with spaces/slashes.
    if (!/^[0-9a-fA-F:]+$/.test(s) || s.length > 45) return null;
    return s.toLowerCase();
  }
  const parts = s.split('.');
  if (parts.length !== 4) return null;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
  }
  return s;
}

export function clientIpFromRequest(req: Request): string {
  const cf = parseClientIpToken(req.headers.get('cf-connecting-ip'));
  if (cf) return cf;

  const xf = req.headers.get('x-forwarded-for');
  if (xf) {
    const hops = xf.split(',');
    for (let i = hops.length - 1; i >= 0; i--) {
      const ip = parseClientIpToken(hops[i]);
      if (ip) return ip;
    }
  }

  const real = parseClientIpToken(req.headers.get('x-real-ip'));
  if (real) return real;

  return 'unknown';
}
