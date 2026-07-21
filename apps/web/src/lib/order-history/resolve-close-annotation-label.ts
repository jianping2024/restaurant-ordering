import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import type { OrderHistoryCloseAnnotation } from '@/lib/order-history/types';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

export function resolveForcedUnpaidCloseSummary(
  lang: UILanguage,
  annotation: OrderHistoryCloseAnnotation,
): string | null {
  if (!annotation.isForcedUnpaidClose) return null;

  const i18n = getMessages(lang).orderHistory;
  const labels = abnormalReasonOptions(lang, 'unpaid_close');
  const reasonLabel =
    labels.find((option) => option.value === annotation.reasonCode)?.label ??
    annotation.reasonCode;

  return i18n.forcedUnpaidCloseSummary.replace('{reason}', reasonLabel);
}

export function resolveForcedUnpaidCloseDetail(
  annotation: OrderHistoryCloseAnnotation,
): string | null {
  if (!annotation.isForcedUnpaidClose) return null;
  const detail = annotation.reasonDetail?.trim();
  return detail || null;
}
