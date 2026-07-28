import { canDecrementOrderItem } from '@/lib/order-item-void/decrement-order-item';
import { can, type Capabilities } from '@/lib/permissions/can';
import type { Order, OrderItem } from '@/types';

export function menuDecrementAllowedFromCaps(capabilities: Capabilities): boolean {
  return can(capabilities, 'orders.menu_decrement');
}

export function canDecrementOrderLine(
  capabilities: Capabilities,
  item: OrderItem,
  orderStatus: Order['status'],
): boolean {
  if (!menuDecrementAllowedFromCaps(capabilities)) return false;
  return canDecrementOrderItem(item, orderStatus);
}
