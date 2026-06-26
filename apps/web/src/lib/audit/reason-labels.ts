import {
  DISCOUNT_REASONS,
  UNPAID_CLOSE_REASONS,
  VOID_ITEM_REASONS,
  type AbnormalReasonGroup,
} from '@/lib/audit/reasons';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

const REASON_CODES: Record<AbnormalReasonGroup, readonly string[]> = {
  discount: DISCOUNT_REASONS,
  void_item: VOID_ITEM_REASONS,
  unpaid_close: UNPAID_CLOSE_REASONS,
};

export function abnormalReasonOptions(lang: UILanguage, group: AbnormalReasonGroup) {
  const messages = getMessages(lang);
  const labels =
    group === 'discount'
      ? messages.checkout.discountReasons
      : group === 'void_item'
        ? messages.orderHistory.voidItemReasons
        : messages.orderHistory.unpaidCloseReasons;

  return REASON_CODES[group].map((value) => ({
    value,
    label: labels[value as keyof typeof labels] ?? value,
  }));
}
