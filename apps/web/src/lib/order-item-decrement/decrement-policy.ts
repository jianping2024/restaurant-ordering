import { canDecrementOrderItem } from '@/lib/order-item-void/decrement-order-item';
import type { StaffRole } from '@/lib/staff-account';
import type { Order, OrderItem } from '@/types';

/** Who is performing a menu-line decrement (not buffet guest-count edits). */
export type MenuDecrementOperator = 'waiter_staff' | 'frontdesk_staff' | 'owner';

/** Floor staff who may decrement menu lines from the dashboard waiter board. */
const FLOOR_MENU_DECREMENT_STAFF_ROLES = new Set<StaffRole>(['frontdesk', 'cashier']);

export function resolveMenuDecrementOperator(input: {
  role: StaffRole;
  asOwner?: boolean;
}): MenuDecrementOperator {
  if (input.asOwner) return 'owner';
  if (FLOOR_MENU_DECREMENT_STAFF_ROLES.has(input.role)) return 'frontdesk_staff';
  return 'waiter_staff';
}

export function menuDecrementAllowedFor(operator: MenuDecrementOperator): boolean {
  return operator === 'frontdesk_staff' || operator === 'owner';
}

export function canDecrementOrderLine(
  operator: MenuDecrementOperator,
  item: OrderItem,
  orderStatus: Order['status'],
): boolean {
  if (!menuDecrementAllowedFor(operator)) return false;
  return canDecrementOrderItem(item, orderStatus);
}
