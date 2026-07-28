import type { SupabaseClient } from '@supabase/supabase-js';
import {
  emptyGuestOrderingNotice,
  normalizeGuestOrderingNotice,
  parseGuestOrderingNoticeDraft,
  validateGuestOrderingNoticeDraft,
  type GuestOrderingNotice,
  type GuestOrderingNoticeValidationError,
} from '@/lib/guest-ordering-notice';

export type GuestNoticeMutationError = {
  error: GuestOrderingNoticeValidationError | 'update_failed' | 'not_found';
  status: number;
};

export async function loadGuestOrderingNotice(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<GuestOrderingNotice> {
  const { data, error } = await admin
    .from('restaurants')
    .select('guest_ordering_notice')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error || !data) return emptyGuestOrderingNotice();
  return normalizeGuestOrderingNotice(data.guest_ordering_notice);
}

export async function saveGuestOrderingNotice(
  admin: SupabaseClient,
  restaurantId: string,
  body: Record<string, unknown>,
): Promise<GuestOrderingNotice | GuestNoticeMutationError> {
  const draft = parseGuestOrderingNoticeDraft(body);
  const validationError = validateGuestOrderingNoticeDraft(draft);
  if (validationError) {
    return { error: validationError, status: 400 };
  }

  const next: GuestOrderingNotice = {
    enabled: draft.enabled,
    title: draft.title,
    body: draft.body,
    updated_at: draft.enabled ? new Date().toISOString() : draft.updated_at,
  };

  const { data, error } = await admin
    .from('restaurants')
    .update({ guest_ordering_notice: next })
    .eq('id', restaurantId)
    .select('guest_ordering_notice')
    .maybeSingle();

  if (error || !data) {
    return { error: 'update_failed', status: 500 };
  }

  return normalizeGuestOrderingNotice(data.guest_ordering_notice);
}
