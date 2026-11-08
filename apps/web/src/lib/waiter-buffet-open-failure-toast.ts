import { showToast } from '@/components/ui/Toast';
import type { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { BUFFET_NOT_AVAILABLE_NOW, BUFFET_OPEN_ALREADY_OPEN } from '@/lib/buffet-waiter-open-intent';
import { BUFFET_SWITCH_LOCKED } from '@/lib/buffet-checkout-entry';
import { BUFFET_HEADCOUNT_BELOW_PAID_FLOOR } from '@/lib/buffet-paid-headcount-floor';
import {
  DEPENDENCY_UNAVAILABLE,
  isDependencyUnavailableCode,
} from '@/lib/dependency-unavailable';

type WaiterCopy = (typeof WAITER_TEXT)[keyof typeof WAITER_TEXT];

export type WaiterBuffetOpenFailureKind =
  | 'already_open'
  | 'session_billing'
  | 'paid_floor'
  | 'not_available_now'
  | 'switch_locked'
  | 'no_price'
  | 'dependency'
  | 'conflict'
  | 'generic';

export function classifyWaiterBuffetOpenFailure(result: {
  status?: number;
  code?: string;
}): WaiterBuffetOpenFailureKind {
  if (result.status === 409 && result.code === BUFFET_OPEN_ALREADY_OPEN) return 'already_open';
  if (result.status === 409 && result.code === 'session_billing') return 'session_billing';
  if (result.status === 409 && result.code === BUFFET_HEADCOUNT_BELOW_PAID_FLOOR) {
    return 'paid_floor';
  }
  if (result.status === 409 && result.code === BUFFET_NOT_AVAILABLE_NOW) return 'not_available_now';
  if (result.status === 409 && result.code === BUFFET_SWITCH_LOCKED) return 'switch_locked';
  if (result.status === 400 && result.code === 'no_price_rule') return 'no_price';
  if (
    result.status === 503 ||
    isDependencyUnavailableCode(result.code) ||
    result.code === DEPENDENCY_UNAVAILABLE
  ) {
    return 'dependency';
  }
  if (result.status === 409) return 'conflict';
  return 'generic';
}

/** Single failure toast path for open-table / save-headcount POST failures. */
export function toastWaiterBuffetOpenFailure(
  t: WaiterCopy,
  result: { status?: number; code?: string },
): void {
  switch (classifyWaiterBuffetOpenFailure(result)) {
    case 'already_open':
      showToast(t.refreshHint, 'info');
      return;
    case 'session_billing':
      showToast(t.checkoutLockedHint, 'info');
      return;
    case 'paid_floor':
      showToast(t.buffetHeadcountBelowPaidFloor, 'error');
      return;
    case 'not_available_now':
      showToast(t.buffetNotAvailableNow, 'error');
      return;
    case 'switch_locked':
      showToast(t.buffetSwitchLocked, 'error');
      return;
    case 'no_price':
      showToast(t.buffetNoRule, 'error');
      return;
    case 'dependency':
      showToast(t.serviceUnavailable, 'error');
      return;
    case 'conflict':
      showToast(t.refreshHint, 'error');
      return;
    default:
      showToast(t.actionFailed, 'error');
  }
}
