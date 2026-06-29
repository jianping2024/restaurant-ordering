/** Cross-component sync when checkout queue length changes without a reliable Realtime event. */
export const CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT = 'mesa:checkout-request-count-invalidate';

export function invalidateCheckoutRequestCount(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT));
}
