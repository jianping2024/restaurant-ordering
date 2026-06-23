import { createHmac, timingSafeEqual } from 'crypto';

export type OrderEnqueueTokenClaims = {
  typ: 'order_enqueue';
  restaurant_id: string;
  order_id: string;
  batch_id: string;
  iat: number;
  exp: number;
};

const TTL_SEC = 10 * 60; // single-use window for post-submit enqueue

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function orderEnqueueSecret(): string | null {
  const s =
    process.env.ORDER_ENQUEUE_SECRET ||
    process.env.STAFF_SESSION_SECRET ||
    process.env.PRINT_AGENT_JWT_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

export function signOrderEnqueueToken(
  claims: Pick<OrderEnqueueTokenClaims, 'restaurant_id' | 'order_id' | 'batch_id'>,
  secret: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: OrderEnqueueTokenClaims = {
    typ: 'order_enqueue',
    restaurant_id: claims.restaurant_id,
    order_id: claims.order_id,
    batch_id: claims.batch_id,
    iat: now,
    exp: now + TTL_SEC,
  };
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyOrderEnqueueToken(
  token: string,
  secret: string,
  expected: Pick<OrderEnqueueTokenClaims, 'restaurant_id' | 'order_id' | 'batch_id'>,
): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expectedSig = createHmac('sha256', secret).update(data).digest('base64url');
  if (!safeEqual(s, expectedSig)) return false;
  let payload: OrderEnqueueTokenClaims;
  try {
    payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as OrderEnqueueTokenClaims;
  } catch {
    return false;
  }
  if (payload.typ !== 'order_enqueue') return false;
  if (payload.restaurant_id !== expected.restaurant_id) return false;
  if (payload.order_id !== expected.order_id) return false;
  if (payload.batch_id !== expected.batch_id) return false;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) return false;
  return true;
}
