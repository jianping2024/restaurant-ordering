import type { SupabaseClient } from '@supabase/supabase-js';
import { isPrintAgentDeviceActiveInDb } from '@mesa/shared';
import { verifyPrintAgentJwt } from '@/lib/print-agent-jwt';

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  return h.slice(7).trim() || null;
}

/** JWT signature + claims only (no DB device row check). */
export function verifyAgentBearer(req: Request): { restaurant_id: string; device_id: string } | null {
  const secret = process.env.PRINT_AGENT_JWT_SECRET;
  if (!secret) return null;
  const token = getBearerToken(req);
  if (!token) return null;
  const claims = verifyPrintAgentJwt(token, secret);
  if (!claims) return null;
  return { restaurant_id: claims.restaurant_id, device_id: claims.device_id };
}

/** JWT valid and print_agent_devices row is active (not revoked, not expired). */
export async function verifyActiveAgentBearer(
  req: Request,
  admin: SupabaseClient,
): Promise<{ restaurant_id: string; device_id: string } | null> {
  const ctx = verifyAgentBearer(req);
  if (!ctx) return null;
  const active = await isPrintAgentDeviceActiveInDb(admin, ctx.device_id, ctx.restaurant_id);
  return active ? ctx : null;
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
