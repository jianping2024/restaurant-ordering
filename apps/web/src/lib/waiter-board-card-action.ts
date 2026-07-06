import type { WaiterTableBoardState } from '@/lib/waiter-board-session';

export type WaiterBoardCardAction =
  | { kind: 'open_table_sheet' }
  | { kind: 'open_checkout_sheet' }
  | { kind: 'navigate'; href: string }
  | { kind: 'disabled'; reason: 'no_buffet_config' | 'waiter_checkout' };

export function resolveWaiterBoardCardAction(input: {
  boardState: WaiterTableBoardState;
  embeddedInDashboard: boolean;
  restaurantHasActiveBuffets: boolean;
  detailHref: string;
}): WaiterBoardCardAction {
  const { boardState, embeddedInDashboard, restaurantHasActiveBuffets, detailHref } = input;

  if (boardState === 'checkout') {
    if (embeddedInDashboard) {
      return { kind: 'open_checkout_sheet' };
    }
    return { kind: 'navigate', href: detailHref };
  }

  if (boardState === 'dining') {
    return { kind: 'navigate', href: detailHref };
  }

  if (!restaurantHasActiveBuffets) {
    return { kind: 'disabled', reason: 'no_buffet_config' };
  }

  return { kind: 'open_table_sheet' };
}

export function waiterBoardCardActionLabelKey(
  action: WaiterBoardCardAction,
  boardState: WaiterTableBoardState,
):
  | 'cardActionOpenTable'
  | 'cardActionViewOrder'
  | 'cardActionViewDetail'
  | 'cardActionCheckout' {
  if (action.kind === 'open_table_sheet') return 'cardActionOpenTable';
  if (action.kind === 'open_checkout_sheet') return 'cardActionCheckout';
  if (boardState === 'idle') return 'cardActionOpenTable';
  if (boardState === 'checkout') return 'cardActionViewDetail';
  if (boardState === 'dining') return 'cardActionViewOrder';
  return 'cardActionViewOrder';
}
