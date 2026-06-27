import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

export type VoidItemReasonDialogCopy = {
  title: string;
  message: string;
  reasonLabel: string;
  detailLabel: string;
  detailPlaceholder: string;
  reasonRequiredError: string;
  detailRequiredError: string;
  reasons: ReturnType<typeof abnormalReasonOptions>;
};

export function voidItemReasonDialogCopy(lang: UILanguage): VoidItemReasonDialogCopy {
  const orderHistory = getMessages(lang).orderHistory;
  return {
    title: orderHistory.voidItemReasonTitle,
    message: orderHistory.voidItemReasonMessage,
    reasonLabel: orderHistory.voidItemReasonLabel,
    detailLabel: orderHistory.voidItemReasonDetailLabel,
    detailPlaceholder: orderHistory.voidItemReasonDetailPlaceholder,
    reasonRequiredError: orderHistory.voidItemReasonRequired,
    detailRequiredError: orderHistory.voidItemReasonDetailRequired,
    reasons: abnormalReasonOptions(lang, 'void_item'),
  };
}

export function voidItemReasonErrorMessage(
  lang: UILanguage,
  code: string | undefined,
): string | null {
  const copy = voidItemReasonDialogCopy(lang);
  if (code === 'reason_detail_required') return copy.detailRequiredError;
  if (code === 'reason_required' || code === 'invalid_reason') return copy.reasonRequiredError;
  return null;
}
