import { coerceCartQty, sumLineTotals } from '@/lib/cart-totals';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { waiterBillHref } from '@/lib/staff-routes';
import type { CartItem, Order, TableSession } from '@/types';

export type MenuPageFooterInput = {
  cart: CartItem[];
  recentOrders: Order[];
  activeSession: TableSession | null;
  sessionResolved: boolean;
  staffAssisted: StaffAssistedFlow | null;
  restaurantSlug: string;
  tableId: string;
};

export type MenuPageFooterView = {
  visible: boolean;
  cartQty: number;
  cartTotal: number;
  billHref: string;
  billEnabled: boolean;
  showBillCta: boolean;
};

function countSubmittedItems(recentOrders: Order[]): number {
  return recentOrders.reduce((sum, order) => sum + order.items.length, 0);
}

/** Derives fixed footer state from existing menu-page data — no extra client state. */
export function deriveMenuPageFooter(input: MenuPageFooterInput): MenuPageFooterView {
  const cartQty = input.cart.reduce((sum, item) => sum + coerceCartQty(item.qty), 0);
  const cartTotal = sumLineTotals(input.cart);
  const submittedItemCount = countSubmittedItems(input.recentOrders);

  const showBillCta = input.staffAssisted
    ? input.staffAssisted.showBillCta && !!input.activeSession
    : !!input.activeSession;

  const billHref = input.staffAssisted?.showBillCta
    ? waiterBillHref(input.restaurantSlug, input.tableId, { embeddedInDashboard: true })
    : `/${input.restaurantSlug}/bill?table_id=${encodeURIComponent(input.tableId)}`;

  return {
    visible: input.sessionResolved,
    cartQty,
    cartTotal,
    billHref,
    billEnabled: !!input.activeSession && submittedItemCount > 0,
    showBillCta,
  };
}
