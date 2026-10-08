import { isWaiterBoardTableCardClickable } from '@/lib/waiter-board-permissions';
import type { WaiterTableBoardState } from '@/lib/waiter-board-session';

export type WaiterBoardCardAction =
  | { kind: 'open_table_sheet' }
  | { kind: 'navigate'; href: string }
  | { kind: 'disabled'; reason: 'no_buffet_config' | 'waiter_checkout' };

export function isWaiterBoardCardInteractive(action: WaiterBoardCardAction): boolean {
  return !(action.kind === 'disabled' && action.reason === 'waiter_checkout');
}

export function resolveWaiterBoardCardAction(input: {
  boardState: WaiterTableBoardState;
  canOpenCheckoutPendingTables: boolean;
  supportsBuffetOpenTable: boolean;
  /** Sole tables.open_session — idle open-table sheet. */
  canOpenTableSession: boolean;
  detailHref: string;
  /** Pending checkout → sole `/dashboard/checkout` queue (with list). */
  checkoutHref: string;
}): WaiterBoardCardAction {
  const {
    boardState,
    canOpenCheckoutPendingTables,
    supportsBuffetOpenTable,
    canOpenTableSession,
    detailHref,
    checkoutHref,
  } = input;

  if (boardState === 'checkout') {
    if (isWaiterBoardTableCardClickable(canOpenCheckoutPendingTables, boardState)) {
      return { kind: 'navigate', href: checkoutHref };
    }
    return { kind: 'disabled', reason: 'waiter_checkout' };
  }

  if (boardState === 'dining') {
    return { kind: 'navigate', href: detailHref };
  }

  if (!supportsBuffetOpenTable) {
    return { kind: 'disabled', reason: 'no_buffet_config' };
  }

  if (!canOpenTableSession) {
    return { kind: 'navigate', href: detailHref };
  }

  return { kind: 'open_table_sheet' };
}

export type WaiterBoardCardActionLabelKey =
  | 'cardActionOpenTable'
  | 'cardActionViewOrder'
  | 'cardActionCheckout'
  | 'checkoutPendingSubtitle';

export function waiterBoardCardActionLabelKey(
  action: WaiterBoardCardAction,
  boardState: WaiterTableBoardState,
): WaiterBoardCardActionLabelKey {
  if (action.kind === 'disabled' && action.reason === 'waiter_checkout') {
    return 'checkoutPendingSubtitle';
  }
  if (action.kind === 'open_table_sheet') return 'cardActionOpenTable';
  if (action.kind === 'navigate' && boardState === 'checkout') return 'cardActionCheckout';
  if (boardState === 'idle') return 'cardActionOpenTable';
  if (boardState === 'dining') return 'cardActionViewOrder';
  return 'cardActionViewOrder';
}
