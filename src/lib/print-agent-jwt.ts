import { createHmac, timingSafeEqual } from 'crypto';

export type PrintAgentJwtClaims = {
  typ: 'print_agent';
  restaurant_id: string;
  device_id: string;
  iat: number;
  exp: number;
};

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function signPrintAgentJwt(
  claims: Omit<PrintAgentJwtClaims, 'iat' | 'exp' | 'typ'>,
  secret: string,
  expiresInSec: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: PrintAgentJwtClaims = {
    typ: 'print_agent',
    restaurant_id: claims.restaurant_id,
    device_id: claims.device_id,
    iat: now,
    exp: now + expiresInSec,
  };
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyPrintAgentJwt(token: string, secret: string): PrintAgentJwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  if (!safeEqual(s, expected)) return null;
  let payload: PrintAgentJwtClaims;
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as PrintAgentJwtClaims;
  } catch {
    return null;
  }
  if (payload.typ !== 'print_agent') return null;
  if (!payload.restaurant_id || !payload.device_id) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  return payload;
}
