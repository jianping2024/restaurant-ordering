import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sole stamp of `bill_splits.staff_checkout_requested_at` (SQL `mark_bill_split_staff_checkout`):
 * staff took over this split's checkout, so it stays in the queue while money is owed
 * even when no called-unpaid ticket exists (e.g. every by-item ticket paid, dishes left).
 * Callers: staff floor 呼叫结账 entry + by-item collect that holds the session open;
 * SQL `individual_checkout_apply(unlock)` also calls the same RPC when the session has
 * collected payment and no called-unpaid ticket remains.
 * Cleared by `resume_table_session_ordering`, or by unlock when nothing was collected.
 */
export async function markBillSplitStaffCheckout(
  admin: SupabaseClient,
  restaurantId: string,
  billSplitId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await admin.rpc('mark_bill_split_staff_checkout', {
    p_restaurant_id: restaurantId,
    p_bill_split_id: billSplitId,
  });
  return error ? { ok: false, message: error.message } : { ok: true };
}
