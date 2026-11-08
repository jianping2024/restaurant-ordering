import {
  buffetGuestCountViolation,
  isTableBuffetUnchanged,
  type BuffetGuestCountViolation,
  type BuffetGuestRule,
  type TableBuffetSelection,
} from '@/lib/buffet-order';
import {
  BUFFET_OPEN_ALREADY_OPEN,
  buffetWaiterOpenIntentFromSession,
  type BuffetWaiterOpenIntent,
} from '@/lib/buffet-waiter-open-intent';
import {
  DEPENDENCY_UNAVAILABLE,
  isDependencyFailure,
} from '@/lib/dependency-unavailable';
import { postWaiterBuffetOpenClient } from '@/lib/staff-board-client';
import { commitAuthoritativeWaiterTablePageModel } from '@/lib/waiter-staff-mutation-sync';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import type { Order } from '@/types';

export type BuffetOpenSubmitBlockReason =
  | { code: 'unchanged' }
  | { code: 'editor_not_ready' }
  | BuffetGuestCountViolation;

export {
  BUFFET_OPEN_ALREADY_OPEN,
  buffetWaiterOpenIntentFromSession,
};
export type { BuffetWaiterOpenIntent };

/**
 * Client-side guards before POST …/staff/waiter/buffet: unchanged / editor not ready,
 * then the sole headcount rule (`buffetGuestCountViolation`, same as the server pipeline).
 */
export function buffetOpenSubmitBlockReason(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  draft: TableBuffetSelection | null,
  editorReady: boolean,
  hasOpenSession: boolean,
  guestRule: BuffetGuestRule | null,
): BuffetOpenSubmitBlockReason | null {
  if (isTableBuffetUnchanged(orders, draft)) {
    if (hasOpenSession) return { code: 'unchanged' };
  } else if (!editorReady) {
    return { code: 'editor_not_ready' };
  }
  if (!draft || !guestRule) return null;
  return buffetGuestCountViolation({ ...guestRule, adults: draft.adults, children: draft.children });
}

export type WaiterBuffetOpenPostResult =
  | { ok: true; model: WaiterTablePageModel }
  | { ok: false; status?: number; code?: string; message?: string };

/** Persist buffet open / guest-count save; commits authoritative page model on success. */
export async function postWaiterBuffetOpenAndCommit(input: {
  restaurantSlug: string;
  tableId: string;
  buffet: TableBuffetSelection;
  intent: BuffetWaiterOpenIntent;
}): Promise<WaiterBuffetOpenPostResult> {
  try {
    const nextModel = await postWaiterBuffetOpenClient(input.restaurantSlug, {
      table_id: input.tableId,
      intent: input.intent,
      buffet: {
        buffet_id: input.buffet.buffetId,
        adult_count: input.buffet.adults,
        child_count: input.buffet.children,
      },
    });
    commitAuthoritativeWaiterTablePageModel(nextModel);
    return { ok: true, model: nextModel };
  } catch (err) {
    const apiErr = err as Error & { status?: number; code?: string; detail?: string };
    if (isDependencyFailure(err) || apiErr.code === DEPENDENCY_UNAVAILABLE) {
      return { ok: false, status: 503, code: DEPENDENCY_UNAVAILABLE };
    }
    return {
      ok: false,
      status: apiErr.status,
      code: apiErr.code ?? apiErr.message,
      message: apiErr.detail,
    };
  }
}
