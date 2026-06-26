import { VOID_ITEM_REASONS } from '@/lib/audit/reasons';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

export function voidItemReasonOptions(lang: UILanguage) {
  const labels = getMessages(lang).orderHistory.voidItemReasons;
  return VOID_ITEM_REASONS.map((value) => ({
    value,
    label: labels[value] ?? value,
  }));
}
