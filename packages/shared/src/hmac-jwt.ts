import { createHmac, timingSafeEqual } from 'crypto';

export function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

export function safeEqualStrings(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function signHmacJwt<T extends Record<string, unknown>>(
  payload: T,
  secret: string,
): string {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyHmacJwt<T extends Record<string, unknown>>(
  token: string,
  secret: string,
): T | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  if (!safeEqualStrings(s, expected)) return null;
  try {
    return JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
