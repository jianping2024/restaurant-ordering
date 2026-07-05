import type { SupabaseClient } from '@supabase/supabase-js';
import type { BillSplit, BillStatus, SplitResult } from '@/types';

/** Minimal bill_split fields for reprinting a closed session via checkout_bill. */
export type OrderHistoryBillSplitRef = Pick<
  BillSplit,
  'id' | 'session_id' | 'table_id' | 'discount_rate'
>;

export type OrderHistoryBillSplitSummary = OrderHistoryBillSplitRef & {
  status: BillStatus;
  total_amount: number;
  result: SplitResult[];
};

const ORDER_HISTORY_BILL_SPLIT_STATUSES = ['paid', 'cancelled'] as const;

const BILL_SPLIT_SELECT =
  'id, session_id, table_id, discount_rate, status, total_amount, result, created_at';

/** Latest paid/cancelled split per session for order history. */
export async function loadBillSplitsForOrderHistory(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Record<string, OrderHistoryBillSplitSummary>> {
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

  const bySession: Record<string, OrderHistoryBillSplitSummary> = {};
  for (const row of data) {
    const sessionId = row.session_id as string | null;
    if (!sessionId || bySession[sessionId]) continue;
    bySession[sessionId] = {
      id: row.id as string,
      session_id: sessionId,
      table_id: row.table_id as string,
      discount_rate: Number(row.discount_rate ?? 0),
      status: row.status as BillStatus,
      total_amount: Number(row.total_amount ?? 0),
      result: (row.result || []) as SplitResult[],
    };
  }
  return bySession;
}
