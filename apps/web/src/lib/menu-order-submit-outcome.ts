import { showToast } from '@/components/ui/Toast';

/** How long the "NEW" tag highlights a batch on the guest menu order list. */
export const NEW_BATCH_HIGHLIGHT_MS = 15_000;

export function markLatestSubmittedBatch(
  batchId: string,
  setLatestBatchId: (id: string | null) => void,
): void {
  setLatestBatchId(batchId);
  setTimeout(() => setLatestBatchId(null), NEW_BATCH_HIGHLIGHT_MS);
}

/** Guest menu: stay on page — toast + order-list NEW tag; cart already cleared by caller path. */
export function completeGuestOrderSubmit(params: {
  batchId: string;
  orderSuccessMessage: string;
  clearCart: () => void;
  setLatestBatchId: (id: string | null) => void;
}): void {
  params.clearCart();
  markLatestSubmittedBatch(params.batchId, params.setLatestBatchId);
  showToast(params.orderSuccessMessage, 'success');
}

/** Staff-assisted menu: return to table detail immediately; confirmation lives on waiter board. */
export function completeStaffAssistedOrderSubmit(params: {
  returnHref: string;
  clearCart: () => void;
  navigate: (href: string) => void;
}): void {
  params.clearCart();
  params.navigate(params.returnHref);
}
