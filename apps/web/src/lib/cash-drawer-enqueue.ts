import type { SupabaseClient } from '@supabase/supabase-js';

/** Default TTL for cash-drawer hang-queue (Agent must pull before expiry). */
export const CASH_DRAWER_JOB_TTL_MS = 60_000;

/**
 * Sole server enqueue for fiscal Agent cash-drawer kick after CASH collect.
 * Fire-and-forget from confirm-payment — never throws into the payment result.
 */
export async function enqueueCashDrawerOpen(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string | null;
  collectedPaymentId: string | null;
}): Promise<void> {
  const { admin, restaurantId, sessionId, collectedPaymentId } = params;
  const now = Date.now();
  const expiresAt = new Date(now + CASH_DRAWER_JOB_TTL_MS).toISOString();
  const { error } = await admin.from('cash_drawer_jobs').insert({
    restaurant_id: restaurantId,
    session_id: sessionId,
    collected_payment_id: collectedPaymentId,
    status: 'pending',
    expires_at: expiresAt,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  });
  if (error) {
    // Payment already committed; drawer is best-effort.
    console.error('cash_drawer_enqueue_failed', error.message);
  }
}
