import type { Order } from '@/types';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import { isBuffetBaseItem } from '@/lib/order-items';

export interface WaiterTableCardData {
  table: number;
  pending: number;
  cooking: number;
  ready: number;
  readyItems: string[];
  buffetLines: string[];
  voidedItems: string[];
  voidableItems: Array<{ orderId: string; itemIdx: number; label: string; status: 'pending' | 'cooking' }>;
  updatedAt: string;
}

export function buildWaiterTableCard(tableNumber: number, orders: Order[]): WaiterTableCardData {
  const current: WaiterTableCardData = {
    table: tableNumber,
    pending: 0,
    cooking: 0,
    ready: 0,
    readyItems: [],
    buffetLines: [],
    voidedItems: [],
    voidableItems: [],
    updatedAt: '',
  };

  orders
    .filter((o) => o.table_number === tableNumber)
    .forEach((order) => {
      const ts = order.updated_at || order.created_at;
      if (ts && (!current.updatedAt || ts > current.updatedAt)) {
        current.updatedAt = ts;
      }

      order.items.forEach((item) => {
        const status = normalizeOrderItemStatus(item, order.status) as 'pending' | 'cooking' | 'done' | 'voided';
        if (isBuffetBaseItem(item)) {
          if (status !== 'voided') {
            const adults = item.adult_count ?? 0;
            const children = item.child_count ?? 0;
            current.buffetLines.push(
              `🍽️ ${item.name || item.name_pt} · A${adults} C${children} · €${(item.price * item.qty).toFixed(2)}`,
            );
          }
          return;
        }
        if (status === 'pending') current.pending += item.qty;
        if (status === 'cooking') current.cooking += item.qty;
        if (status === 'done') {
          current.ready += item.qty;
          current.readyItems.push(`${item.emoji} ${item.name || item.name_pt} × ${item.qty}`);
        }
        if (status === 'voided') {
          current.voidedItems.push(`${item.emoji} ${item.name || item.name_pt} × ${item.qty}`);
        }
      });

      order.items.forEach((item, itemIdx) => {
        if (isBuffetBaseItem(item)) return;
        const status = normalizeOrderItemStatus(item, order.status) as 'pending' | 'cooking' | 'done' | 'voided';
        if (status === 'pending' || status === 'cooking') {
          current.voidableItems.push({
            orderId: order.id,
            itemIdx,
            status,
            label: `${item.emoji} ${item.name || item.name_pt} × ${item.qty}`,
          });
        }
      });
    });

  return current;
}
