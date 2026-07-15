import { coerceCartQty, sumLineTotals } from '@/lib/cart-totals';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { waiterBillHref } from '@/lib/staff-routes';
import type { CartItem, Order, TableSession } from '@/types';

export type MenuPageFooterPhase = 'idle' | 'draft' | 'ordered';

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
  phase: MenuPageFooterPhase;
  cartQty: number;
  cartTotal: number;
  submittedCount: number;
  billHref: string;
  billEnabled: boolean;
  showBillCta: boolean;
  showOrderedCta: boolean;
};

function countSubmittedItems(recentOrders: Order[]): number {
  return recentOrders.reduce((sum, order) => sum + order.items.length, 0);
}

function deriveFooterPhase(cartQty: number, submittedCount: number): MenuPageFooterPhase {
  if (cartQty > 0) return 'draft';
  if (submittedCount > 0) return 'ordered';
  return 'idle';
}

/** Derives fixed footer state from existing menu-page data — no extra client state. */
export function deriveMenuPageFooter(input: MenuPageFooterInput): MenuPageFooterView {
  const cartQty = input.cart.reduce((sum, item) => sum + coerceCartQty(item.qty), 0);
  const cartTotal = sumLineTotals(input.cart);
  const submittedCount = countSubmittedItems(input.recentOrders);
  const phase = deriveFooterPhase(cartQty, submittedCount);

  const showBillCta = input.staffAssisted
    ? input.staffAssisted.showBillCta && !!input.activeSession
    : !!input.activeSession;

  const billHref = input.staffAssisted?.showBillCta
    ? waiterBillHref(input.restaurantSlug, input.tableId, { embeddedInDashboard: true })
    : `/${input.restaurantSlug}/bill?table_id=${encodeURIComponent(input.tableId)}`;

  const showOrderedCta = !input.staffAssisted && submittedCount > 0;

  return {
    visible: input.sessionResolved,
    phase,
    cartQty,
    cartTotal,
    submittedCount,
    billHref,
    billEnabled: !!input.activeSession && submittedCount > 0,
    showBillCta,
    showOrderedCta,
  };
}
