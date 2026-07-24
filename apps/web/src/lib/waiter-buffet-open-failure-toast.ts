import { showToast } from '@/components/ui/Toast';
import type { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  DEPENDENCY_UNAVAILABLE,
  isDependencyUnavailableCode,
} from '@/lib/dependency-unavailable';

type WaiterCopy = (typeof WAITER_TEXT)[keyof typeof WAITER_TEXT];

export type WaiterBuffetOpenFailureKind =
  | 'session_billing'
  | 'paid_floor'
  | 'no_price'
  | 'dependency'
  | 'conflict'
  | 'generic';

export function classifyWaiterBuffetOpenFailure(result: {
  status?: number;
  code?: string;
}): WaiterBuffetOpenFailureKind {
  if (result.status === 409 && result.code === 'session_billing') return 'session_billing';
  if (result.status === 409 && result.code === 'buffet_headcount_below_paid_floor') {
    return 'paid_floor';
  }
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
    case 'session_billing':
      showToast(t.checkoutLockedHint, 'info');
      return;
    case 'paid_floor':
      showToast(t.buffetHeadcountBelowPaidFloor, 'error');
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
