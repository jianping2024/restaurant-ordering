/**
 * Sole active bill_split finder for a live session.
 * Floor ensure + fiscal tableId resolve + submit continuation share this —
 * never a second pending|confirmed|requested query beside this.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseSplitMode,
  type CheckoutRequestPayload,
} from '@/lib/checkout-split-intent';
import type { BillSplit, SplitPerson, SplitResult } from '@/types';

export const ACTIVE_BILL_SPLIT_STATUSES = ['pending', 'confirmed', 'requested'] as const;

/** Payload to reopen a preserved active plan (resume → floor call-checkout). */
export function checkoutPayloadFromBillSplit(
  split: Pick<BillSplit, 'split_mode' | 'persons' | 'result' | 'customer_nif'>,
): CheckoutRequestPayload | null {
  const splitMode = parseSplitMode(split.split_mode);
  if (!splitMode) return null;
  const persons = Array.isArray(split.persons) ? (split.persons as SplitPerson[]) : [];
  const result = Array.isArray(split.result) ? (split.result as SplitResult[]) : [];
  if (persons.length === 0 || result.length === 0) return null;
  return {
    splitMode,
    persons,
    result,
    customerNif: split.customer_nif ?? null,
  };
}

export async function loadActiveBillSplitForSession(params: {
  admin: SupabaseClient;
  restaurantId: string;
  sessionId: string;
}): Promise<BillSplit | null> {
  const { data, error } = await params.admin
    .from('bill_splits')
    .select('*')
    .eq('restaurant_id', params.restaurantId)
    .eq('session_id', params.sessionId)
    .in('status', [...ACTIVE_BILL_SPLIT_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data as BillSplit;
}
