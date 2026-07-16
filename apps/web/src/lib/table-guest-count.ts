import type { Order, OrderItem } from '@/types';
import { isBuffetBaseItem, orderItemBatchKey } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';

type OrderLike = Pick<Order, 'status' | 'items' | 'created_at' | 'updated_at'>;

/** Latest non-voided buffet headcount on the table (adults + children). */
export function guestCountFromTableOrders(orders: OrderLike[]): number {
  let best = 0;
  let bestAt = '';
  for (const order of orders) {
    for (const item of order.items || []) {
      if (!isBuffetBaseItem(item)) continue;
      const st = normalizeOrderItemStatus(item, order.status);
      if (st === 'voided') continue;
      const total = (item.adult_count ?? 0) + (item.child_count ?? 0);
      if (total <= 0) continue;
      const at = item.added_at || order.updated_at || order.created_at || '';
      if (!bestAt || at > bestAt) {
        bestAt = at;
        best = total;
      }
    }
  }
  return best;
}

/** Bill checkout requires a confirmed buffet headcount (adults + children > 0). */
export function isBillGuestCountConfirmed(orders: OrderLike[]): boolean {
  return guestCountFromTableOrders(orders) > 0;
}

export function formatStationTicketOrderTime(
  iso: string,
  timeZone = 'Europe/Lisbon',
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(d);
  const pick = (t: Intl.DateTimeFormatPart['type']) =>
    parts.find((p) => p.type === t)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`;
}

/** Earliest line `added_at` in the batch (fallback to order timestamp). */
export function stationTicketOrderTimeIso(
  items: OrderItem[],
  batchId: string,
  fallbackIso: string,
): string {
  let earliest = '';
  for (const item of items) {
    if (orderItemBatchKey(item) !== batchId) continue;
    const at = item.added_at || fallbackIso;
    if (!at) continue;
    if (!earliest || at < earliest) earliest = at;
  }
  return earliest || fallbackIso;
}
