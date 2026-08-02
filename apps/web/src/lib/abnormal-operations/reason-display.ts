import type {
  AbnormalOperationRow,
  AbnormalOperationType,
} from '@/lib/abnormal-operations/types';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

export function abnormalOperationReasonLabel(
  lang: UILanguage,
  type: AbnormalOperationType,
  reason: string,
): string {
  const messages = getMessages(lang);
  if (type === 'DISCOUNT_APPLIED') {
    return messages.checkout.discountReasons[reason as keyof typeof messages.checkout.discountReasons] ?? reason;
  }
  if (type === 'ITEM_DELETED') {
    return messages.orderHistory.voidItemReasons[reason as keyof typeof messages.orderHistory.voidItemReasons] ?? reason;
  }
  return messages.orderHistory.unpaidCloseReasons[reason as keyof typeof messages.orderHistory.unpaidCloseReasons] ?? reason;
}

export function formatAbnormalOperationReasonText(
  lang: UILanguage,
  row: Pick<AbnormalOperationRow, 'type' | 'reason' | 'reason_detail'>,
): string {
  const label = abnormalOperationReasonLabel(lang, row.type, row.reason);
  const detail = row.reason_detail?.trim();
  return detail ? `${label}：${detail}` : label;
}

/** True when the row can open closed-session order history detail. */
export function abnormalOperationHasSessionHistory(
  row: Pick<AbnormalOperationRow, 'session_id'>,
): boolean {
  return Boolean(row.session_id?.trim());
}
