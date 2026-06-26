import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import type { AbnormalOperationRow, AbnormalOperationType } from '@/lib/abnormal-operations/types';
import { waiterTableHref } from '@/lib/staff-routes';

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

/** Owner abnormal-ops list: open table orders on the staff waiter board (owner has slug access). */
export function abnormalOperationTableHref(
  slug: string,
  row: Pick<AbnormalOperationRow, 'table_id'>,
): string | null {
  if (!row.table_id) return null;
  return waiterTableHref(slug, row.table_id);
}
