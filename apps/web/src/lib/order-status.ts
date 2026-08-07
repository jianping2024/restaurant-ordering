/**
 * Single source for kitchen line effective status (plan: station-kitchen-screens).
 * Auto「已出餐」is display-only: cooking + started_at + N → ready; no DB write on clock.
 */

import type { Order, OrderItem, OrderItemStatus } from '@/types';
import { isBuffetBaseItem, kitchenRelevantItems } from '@/lib/order-items';

export const KITCHEN_ITEM_STATUSES = [
  'pending',
  'cooking',
  'ready',
  'done',
  'voided',
] as const satisfies readonly OrderItemStatus[];

type StatusLike = Pick<OrderItem, 'item_status' | 'kind' | 'started_at'>;

export function normalizeOrderItemStatus(
  item: StatusLike,
  fallback: Order['status'],
): OrderItemStatus {
  if (item.item_status === 'pending' || item.item_status === 'cooking' || item.item_status === 'ready' || item.item_status === 'done' || item.item_status === 'voided') {
    return item.item_status;
  }
  if (fallback === 'done') return 'done';
  if (fallback === 'cooking') return 'cooking';
  return 'pending';
}

/** True when every line item is voided (open table with no active kitchen work). */
export function itemsEveryVoided(items: StatusLike[]): boolean {
  const statuses = items.map((item) => normalizeOrderItemStatus(item, 'pending'));
  return statuses.length > 0 && statuses.every((status) => status === 'voided');
}

/**
 * Order-level status follows kitchen-relevant lines only.
 * ready counts as in-progress (board stays active) same as cooking.
 */
export function deriveOrderStatusFromItems(items: OrderItem[]): Order['status'] {
  const kitchen = kitchenRelevantItems(items);
  if (kitchen.length === 0) {
    if (items.length === 0) return 'pending';
    if (items.some((i) => isBuffetBaseItem(i))) return 'done';
    return 'pending';
  }
  if (itemsEveryVoided(kitchen)) return 'pending';
  const statuses = kitchen.map((item) => normalizeOrderItemStatus(item, 'pending'));
  if (statuses.length > 0 && statuses.every((status) => status === 'done' || status === 'voided')) {
    return 'done';
  }
  if (statuses.some((status) => status === 'cooking' || status === 'ready' || status === 'done')) {
    return 'cooking';
  }
  return 'pending';
}

export type EffectiveItemStatusInput = {
  item: StatusLike;
  orderStatus: Order['status'];
  nowMs: number;
  readyAfterMinutes: number;
};

/**
 * Unique effective status for all kitchen / floor / guest displays.
 * Does not write the database.
 */
export function effectiveItemStatus(input: EffectiveItemStatusInput): OrderItemStatus {
  const stored = normalizeOrderItemStatus(input.item, input.orderStatus);
  if (stored !== 'cooking') return stored;
  const started = input.item.started_at ? Date.parse(input.item.started_at) : NaN;
  if (!Number.isFinite(started)) return stored;
  const readyAfterMs = Math.max(0, input.readyAfterMinutes) * 60_000;
  if (input.nowMs >= started + readyAfterMs) return 'ready';
  return 'cooking';
}

export function isKitchenBoardOpenStatus(status: OrderItemStatus): boolean {
  return status === 'pending' || status === 'cooking' || status === 'ready';
}
