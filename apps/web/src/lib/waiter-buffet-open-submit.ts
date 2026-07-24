import {
  buffetEntriesFromSnapshot,
  isBuffetSubmitSnapshotUnchanged,
  type BuffetGuestSnapshot,
} from '@/lib/buffet-order';
import {
  DEPENDENCY_UNAVAILABLE,
  isDependencyFailure,
} from '@/lib/dependency-unavailable';
import { fetchWaiterTablePageModelClient, postWaiterBuffetOpenClient } from '@/lib/staff-board-client';
import { isTableOccupiedForIdleOpen } from '@/lib/waiter-board-open-table';
import { commitAuthoritativeWaiterTablePageModel } from '@/lib/waiter-staff-mutation-sync';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import type { Order } from '@/types';

export type IdleOpenPrecheckResult = 'idle' | 'already_open' | 'unavailable';

/** Submit-time guard: board idle card may be stale; confirm no session before opening. */
export async function precheckIdleOpenTable(
  restaurantSlug: string,
  tableId: string,
): Promise<IdleOpenPrecheckResult> {
  try {
    const model = await fetchWaiterTablePageModelClient(restaurantSlug, tableId);
    if (!model.detail.table) return 'unavailable';
    if (isTableOccupiedForIdleOpen(model)) return 'already_open';
    return 'idle';
  } catch {
    return 'unavailable';
  }
}

export type BuffetOpenSubmitBlockReason = 'unchanged' | 'editor_not_ready';

/** Client-side guards before POST …/staff/waiter/buffet. */
export function buffetOpenSubmitBlockReason(
  orders: Array<Pick<Order, 'items' | 'status'>>,
  guestSnapshot: BuffetGuestSnapshot,
  activeBuffetIds: string[],
  editorReady: boolean,
  hasOpenSession: boolean,
): BuffetOpenSubmitBlockReason | null {
  if (isBuffetSubmitSnapshotUnchanged(orders, guestSnapshot, activeBuffetIds)) {
    if (!hasOpenSession) return null;
    return 'unchanged';
  }
  if (!editorReady) return 'editor_not_ready';
  return null;
}

export type WaiterBuffetOpenPostResult =
  | { ok: true; model: WaiterTablePageModel }
  | { ok: false; status?: number; code?: string };

/** Persist buffet open / guest-count save; commits authoritative page model on success. */
export async function postWaiterBuffetOpenAndCommit(input: {
  restaurantSlug: string;
  tableId: string;
  guestSnapshot: BuffetGuestSnapshot;
  activeBuffetIds: string[];
}): Promise<WaiterBuffetOpenPostResult> {
  try {
    const nextModel = await postWaiterBuffetOpenClient(input.restaurantSlug, {
      table_id: input.tableId,
      buffets: buffetEntriesFromSnapshot(input.guestSnapshot, input.activeBuffetIds).map(
        (entry) => ({
          buffet_id: entry.buffetId,
          adult_count: entry.adults,
          child_count: entry.children,
        }),
      ),
    });
    commitAuthoritativeWaiterTablePageModel(nextModel);
    return { ok: true, model: nextModel };
  } catch (err) {
    const apiErr = err as Error & { status?: number; code?: string };
    if (isDependencyFailure(err) || apiErr.code === DEPENDENCY_UNAVAILABLE) {
      return { ok: false, status: 503, code: DEPENDENCY_UNAVAILABLE };
    }
    return { ok: false, status: apiErr.status, code: apiErr.code ?? apiErr.message };
  }
}
