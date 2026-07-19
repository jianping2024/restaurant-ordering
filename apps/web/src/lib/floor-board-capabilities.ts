import type { StaffRole } from '@/lib/staff-account';

/** Roles that use the production floor board (`/dashboard/waiter`). */
export type FloorBoardRole = Extract<StaffRole, 'waiter' | 'frontdesk' | 'cashier'>;

/**
 * Single source for floor-board UI capabilities (not URL shell).
 * Server APIs keep their own role checks; this drives buttons / assisted checkout CTA.
 */
export type FloorBoardCapabilities = {
  /** Menu line decrement (pending/cooking). */
  canMenuDecrement: boolean;
  /** 关台结账 from table detail. */
  canCheckoutClose: boolean;
  /** Force-close table session. */
  canForceCloseTable: boolean;
  /** Assisted menu/bill: show bill CTA and post-request checkout redirect. */
  canAssistBillCheckout: boolean;
  /** Board: open checkout-pending table cards into detail/sheet. */
  canOpenCheckoutPendingTables: boolean;
};

const DESK: FloorBoardCapabilities = {
  canMenuDecrement: true,
  canCheckoutClose: true,
  canForceCloseTable: true,
  canAssistBillCheckout: true,
  canOpenCheckoutPendingTables: true,
};

const WAITER: FloorBoardCapabilities = {
  canMenuDecrement: false,
  canCheckoutClose: false,
  canForceCloseTable: false,
  canAssistBillCheckout: false,
  canOpenCheckoutPendingTables: false,
};

export function isFloorBoardRole(role: string | null | undefined): role is FloorBoardRole {
  return role === 'waiter' || role === 'frontdesk' || role === 'cashier';
}

export function floorBoardCapabilities(role: FloorBoardRole): FloorBoardCapabilities {
  return role === 'waiter' ? WAITER : DESK;
}
