import type { CheckoutPrintAsk } from '@/components/dashboard/checkout/CheckoutPrintChoiceDialog';
import { parsePortugueseNif } from '@/lib/pt-nif';
import { isWholeTablePayerName } from '@/lib/split-person-label';

/**
 * Sole gate: after collect, skip the print-choice dialog and issue fiscal invoice
 * when bill_sync fiscal is on and (valid NIF or MULTIBANCO/MIXED).
 */
export function shouldAutoIssueFiscalAfterCollect(
  ask: Pick<CheckoutPrintAsk, 'fiscal' | 'paymentMethod' | 'customerNif'>,
): boolean {
  if (!ask.fiscal) return false;
  if (ask.paymentMethod === 'MULTIBANCO' || ask.paymentMethod === 'MIXED') return true;
  return parsePortugueseNif(ask.customerNif) != null;
}

/** Sole seed for CollectPaymentModal「客户名称」from the person being collected. */
export function collectPaymentInitialCustomerName(
  personName: string | null | undefined,
): string {
  const trimmed = personName?.trim() ?? '';
  if (!trimmed || isWholeTablePayerName(trimmed)) return '';
  return trimmed;
}

/** Dedup auto-issue across React Strict Mode remounts (collection id is unique). */
const claimedAutoIssueCollectionIds = new Set<string>();

export function claimCheckoutPrintAskAutoIssue(collectionId: string): boolean {
  if (!collectionId || claimedAutoIssueCollectionIds.has(collectionId)) return false;
  claimedAutoIssueCollectionIds.add(collectionId);
  return true;
}
