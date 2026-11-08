import type { SupabaseClient } from '@supabase/supabase-js';
import type { CheckoutEntrySignals } from '@/lib/buffet-checkout-entry';

/** Sole server read of {@link CheckoutEntrySignals} for one session. */
export async function loadCheckoutEntrySignals(
  admin: SupabaseClient,
  restaurantId: string,
  sessionId: string,
): Promise<CheckoutEntrySignals> {
  const [session, splits, payments] = await Promise.all([
    admin
      .from('table_sessions')
      .select('status')
      .eq('restaurant_id', restaurantId)
      .eq('id', sessionId)
      .maybeSingle(),
    admin
      .from('bill_splits')
      .select('id, status')
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId),
    admin
      .from('session_collected_payments')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId),
  ]);
  if (session.error || splits.error || payments.error) {
    throw new Error('checkout_entry_lookup_failed');
  }
  const splitRows = (splits.data ?? []) as Array<{ id: string; status: string }>;
  const splitIds = splitRows.map((row) => row.id);
  const [calls, invoices] = splitIds.length
    ? await Promise.all([
        admin
          .from('bill_split_ticket_calls')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .in('bill_split_id', splitIds)
          .eq('state', 'called'),
        admin
          .from('bill_sync_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .in('source_sale_id', splitIds)
          .in('status', ['pending', 'succeeded']),
      ])
    : [{ count: 0, error: null }, { count: 0, error: null }];
  if (calls.error || invoices.error) throw new Error('checkout_entry_lookup_failed');
  return {
    sessionBilling: session.data?.status === 'billing',
    checkoutRequested: splitRows.some((row) => row.status === 'requested'),
    calledTicketCount: calls.count ?? 0,
    collectedPaymentCount: payments.count ?? 0,
    invoiceJobCount: invoices.count ?? 0,
  };
}
