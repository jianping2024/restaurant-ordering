import { auditMoney } from '@/lib/audit/money';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import type { Order, OrderItem } from '@/types';

export type MenuItemAgg = {
  itemId: string;
  namePt: string;
  nameEn?: string | null;
  nameZh?: string | null;
  consumedQuantity: number;
  amount: number;
};

export function isCountableMenuLine(item: OrderItem, orderStatus: Order['status']): boolean {
  if (isBuffetBaseItem(item)) return false;
  if (normalizeOrderItemStatus(item, orderStatus) === 'voided') return false;
  const qty = Number(item.qty) || 0;
  return qty > 0;
}

export function aggregateMenuItemsFromOrders(orders: Order[]): Map<string, MenuItemAgg> {
  const map = new Map<string, MenuItemAgg>();

  for (const order of orders) {
    for (const item of order.items) {
      if (!isCountableMenuLine(item, order.status)) continue;

      const itemId = item.id;
      const qty = Number(item.qty) || 0;
      const lineAmount = auditMoney((Number(item.price) || 0) * qty);
      const existing = map.get(itemId);

      if (!existing) {
        map.set(itemId, {
          itemId,
          namePt: item.name_pt || item.name || itemId,
          nameEn: item.name_en ?? null,
          nameZh: item.name_zh ?? null,
          consumedQuantity: qty,
          amount: lineAmount,
        });
        continue;
      }

      existing.consumedQuantity += qty;
      existing.amount = auditMoney(existing.amount + lineAmount);
    }
  }

  return map;
}

export function rankMenuItemAggs(map: Map<string, MenuItemAgg>, limit: number): MenuItemAgg[] {
  return Array.from(map.values())
    .sort(
      (a, b) =>
        b.consumedQuantity - a.consumedQuantity ||
        b.amount - a.amount ||
        a.itemId.localeCompare(b.itemId),
    )
    .slice(0, limit);
}
