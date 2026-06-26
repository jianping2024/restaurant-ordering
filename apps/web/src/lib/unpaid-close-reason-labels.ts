import { UNPAID_CLOSE_REASONS } from '@/lib/audit/reasons';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

export function unpaidCloseReasonOptions(lang: UILanguage) {
  const labels = getMessages(lang).orderHistory.unpaidCloseReasons;
  return UNPAID_CLOSE_REASONS.map((value) => ({
    value,
    label: labels[value] ?? value,
  }));
}
