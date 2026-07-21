import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderHistoryCloseAnnotation } from '@/lib/order-history/types';

type AbnormalCloseRow = {
  session_id: string | null;
  reason: string;
  reason_detail: string | null;
  created_at: string;
};

const FORCED_UNPAID_CLOSE = 'UNPAID_TABLE_CLOSED';

/** Latest forced unpaid close (red button) annotation per session. */
export async function loadForcedUnpaidCloseAnnotations(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Map<string, OrderHistoryCloseAnnotation>> {
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  const map = new Map<string, OrderHistoryCloseAnnotation>();
  if (uniqueSessionIds.length === 0) return map;

  const { data, error } = await admin
    .from('abnormal_operations')
    .select('session_id, reason, reason_detail, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('type', FORCED_UNPAID_CLOSE)
    .in('session_id', uniqueSessionIds)
    .order('created_at', { ascending: false });

  if (error || !data?.length) return map;

  for (const row of data as AbnormalCloseRow[]) {
    const sessionId = row.session_id;
    if (!sessionId || map.has(sessionId)) continue;
    map.set(sessionId, {
      isForcedUnpaidClose: true,
      reasonCode: row.reason,
      reasonDetail: row.reason_detail,
    });
  }

  return map;
}

export function resolveCloseAnnotationForSession(
  sessionId: string,
  forcedBySession: Map<string, OrderHistoryCloseAnnotation>,
): OrderHistoryCloseAnnotation {
  return forcedBySession.get(sessionId) ?? { isForcedUnpaidClose: false };
}
