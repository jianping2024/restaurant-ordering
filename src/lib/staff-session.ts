import { createHmac, timingSafeEqual } from 'crypto';

export type StaffRole = 'kitchen' | 'waiter';

export type StaffSessionClaims = {
  typ: 'staff_session';
  restaurant_id: string;
  slug: string;
  role: StaffRole;
  /** Matches restaurants.kitchen_password_version or waiter_password_version at login time. */
  pwd_ver: number;
  iat: number;
  exp: number;
};

const COOKIE_NAME = 'mesa_staff_session';
const TTL_SEC = 12 * 60 * 60; // 12h shift

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function staffSessionSecret(): string | null {
  const s = process.env.STAFF_SESSION_SECRET || process.env.PRINT_AGENT_JWT_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

export function signStaffSession(
  claims: Pick<StaffSessionClaims, 'restaurant_id' | 'slug' | 'role' | 'pwd_ver'>,
  secret: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: StaffSessionClaims = {
    typ: 'staff_session',
    restaurant_id: claims.restaurant_id,
    slug: claims.slug,
    role: claims.role,
    pwd_ver: claims.pwd_ver,
    iat: now,
    exp: now + TTL_SEC,
  };
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyStaffSessionToken(token: string, secret: string): StaffSessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  if (!safeEqual(s, expected)) return null;
  let payload: StaffSessionClaims;
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as StaffSessionClaims;
  } catch {
    return null;
  }
  if (payload.typ !== 'staff_session') return null;
  if (!payload.restaurant_id || !payload.slug || !payload.role) return null;
  if (payload.role !== 'kitchen' && payload.role !== 'waiter') return null;
  if (typeof payload.pwd_ver !== 'number' || !Number.isFinite(payload.pwd_ver)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  return payload;
}

export function staffSessionCookieName(): string {
  return COOKIE_NAME;
}

export function staffSessionCookieOptions(maxAgeSec = TTL_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}

/** JWT signature/exp only (no password-version check). */
export function peekStaffSessionClaims(
  req: Request,
  slug: string,
  role: StaffRole,
): StaffSessionClaims | null {
  const secret = staffSessionSecret();
  if (!secret) return null;
  const token = parseStaffSessionCookie(req.headers.get('cookie'));
  if (!token) return null;
  const claims = verifyStaffSessionToken(token, secret);
  if (!claims || claims.slug !== slug || claims.role !== role) return null;
  return claims;
}

export function parseStaffSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${COOKIE_NAME}=`)) {
      return decodeURIComponent(part.slice(COOKIE_NAME.length + 1));
    }
  }
  return null;
}
