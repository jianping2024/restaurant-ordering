import { sumBillableSessionTotal } from '@/lib/billable-session-lines';
import { coerceCartQty, sumLineTotals } from '@/lib/cart-totals';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { waiterBillHref } from '@/lib/staff-routes';
import type { CartItem, Order, TableSession } from '@/types';

export type MenuPageFooterPhase = 'idle' | 'draft' | 'ordered';

/** Right-side primary CTA derived from phase — draft submits via cart, not bill. */
export type MenuPageFooterPrimaryAction = 'openCart' | 'viewOrdered' | 'viewBill' | 'none';

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
  primaryAction: MenuPageFooterPrimaryAction;
  cartQty: number;
  cartTotal: number;
  submittedCount: number;
  /** Billable session total (matches waiter sessionTotal and bill details). */
  submittedTotal: number;
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

function derivePrimaryAction(
  phase: MenuPageFooterPhase,
  showBillCta: boolean,
  showOrderedCta: boolean,
): MenuPageFooterPrimaryAction {
  if (phase === 'draft') return 'openCart';
  if (phase === 'ordered' && showOrderedCta) return 'viewOrdered';
  if (showBillCta) return 'viewBill';
  return 'none';
}

/** Derives fixed footer state from existing menu-page data — no extra client state. */
export function deriveMenuPageFooter(input: MenuPageFooterInput): MenuPageFooterView {
  const cartQty = input.cart.reduce((sum, item) => sum + coerceCartQty(item.qty), 0);
  const cartTotal = sumLineTotals(input.cart);
  const submittedCount = countSubmittedItems(input.recentOrders);
  const submittedTotal = sumBillableSessionTotal(input.recentOrders);
  const phase = deriveFooterPhase(cartQty, submittedCount);

  const showBillCta = input.staffAssisted
    ? input.staffAssisted.showBillCta && !!input.activeSession
    : !!input.activeSession;

  const billHref = input.staffAssisted?.showBillCta
    ? waiterBillHref(input.restaurantSlug, input.tableId, { embeddedInDashboard: true })
    : `/${input.restaurantSlug}/bill?table_id=${encodeURIComponent(input.tableId)}`;

  const showOrderedCta = !input.staffAssisted && submittedCount > 0;
  const primaryAction = derivePrimaryAction(phase, showBillCta, showOrderedCta);

  return {
    visible: input.sessionResolved,
    phase,
    primaryAction,
    cartQty,
    cartTotal,
    submittedCount,
    submittedTotal,
    billHref,
    billEnabled: !!input.activeSession && submittedCount > 0,
    showBillCta,
    showOrderedCta,
  };
}
