import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit } from '@/types';

/** Minimal bill_split fields for reprinting a closed session via checkout_bill. */
export type OrderHistoryBillSplitRef = Pick<
  BillSplit,
  'id' | 'session_id' | 'table_id' | 'discount_rate'
>;

const ORDER_HISTORY_BILL_SPLIT_STATUSES = ['paid', 'cancelled'] as const;

const BILL_SPLIT_SELECT = 'id, session_id, table_id, discount_rate, created_at';

/** Latest paid/cancelled split per session for order history reprint. */
export async function loadBillSplitsForOrderHistory(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Record<string, OrderHistoryBillSplitRef>> {
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  if (uniqueSessionIds.length === 0) return {};

  const { data, error } = await admin
    .from('bill_splits')
    .select(BILL_SPLIT_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('session_id', uniqueSessionIds)
    .in('status', [...ORDER_HISTORY_BILL_SPLIT_STATUSES])
    .order('created_at', { ascending: false });

  if (error || !data?.length) return {};

  const bySession: Record<string, OrderHistoryBillSplitRef> = {};
  for (const row of data) {
    const sessionId = row.session_id as string | null;
    if (!sessionId || bySession[sessionId]) continue;
    bySession[sessionId] = {
      id: row.id as string,
      session_id: sessionId,
      table_id: row.table_id as string,
      discount_rate: Number(row.discount_rate ?? 0),
    };
  }
  return bySession;
}
