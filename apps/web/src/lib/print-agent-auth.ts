import { verifyPrintAgentJwt } from '@/lib/print-agent-jwt';

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

export function verifyAgentBearer(req: Request): { restaurant_id: string; device_id: string } | null {
  const secret = process.env.PRINT_AGENT_JWT_SECRET;
  if (!secret) return null;
  const token = getBearerToken(req);
  if (!token) return null;
  const claims = verifyPrintAgentJwt(token, secret);
  if (!claims) return null;
  return { restaurant_id: claims.restaurant_id, device_id: claims.device_id };
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
