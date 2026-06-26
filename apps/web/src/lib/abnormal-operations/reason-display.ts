import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import type { AbnormalOperationType } from '@/lib/abnormal-operations/types';

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
