import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import type { OrderHistoryCloseAnnotation } from '@/lib/order-history/types';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

export type ForcedUnpaidCloseAnnotationLabels = {
  summary: string;
  detail: string | null;
};

export function formatForcedUnpaidCloseAnnotation(
  lang: UILanguage,
  annotation: OrderHistoryCloseAnnotation,
): ForcedUnpaidCloseAnnotationLabels | null {
  if (!annotation.isForcedUnpaidClose) return null;

  const i18n = getMessages(lang).orderHistory;
  const labels = abnormalReasonOptions(lang, 'unpaid_close');
  const reasonLabel =
    labels.find((option) => option.value === annotation.reasonCode)?.label ??
    annotation.reasonCode;

  const detail = annotation.reasonDetail?.trim() || null;

  return {
    summary: i18n.forcedUnpaidCloseSummary.replace('{reason}', reasonLabel),
    detail,
  };
}
