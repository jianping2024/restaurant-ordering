import { abnormalReasonOptions } from '@/lib/audit/reason-labels';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import { formatOrderItemNameLabel } from '@/lib/order-list-display';
import type { OrderItem } from '@/types';

export type VoidItemReasonDialogCopy = {
  title: string;
  message: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  detailLabel: string;
  detailPlaceholder: string;
  confirmLabel: string;
  cancelLabel: string;
  reasonRequiredError: string;
  detailRequiredError: string;
  reasons: ReturnType<typeof abnormalReasonOptions>;
};

export function voidItemDisplayName(item: Pick<OrderItem, 'emoji' | 'name' | 'name_pt'>): string {
  return formatOrderItemNameLabel(item);
}

export function voidItemWasServed(item: Pick<OrderItem, 'item_status'>): boolean {
  return item.item_status === 'done';
}

export function voidItemReasonDialogTitle(
  lang: UILanguage,
  item?: Pick<OrderItem, 'emoji' | 'name' | 'name_pt'> | null,
): string {
  const orderHistory = getMessages(lang).orderHistory;
  if (item) {
    return orderHistory.voidItemReasonTitleWithItem.replace(
      '{item}',
      voidItemDisplayName(item),
    );
  }
  return orderHistory.voidItemReasonTitle;
}

export function voidItemReasonDialogCopy(lang: UILanguage): VoidItemReasonDialogCopy {
  const orderHistory = getMessages(lang).orderHistory;
  return {
    title: orderHistory.voidItemReasonTitle,
    message: orderHistory.voidItemReasonMessage,
    reasonLabel: orderHistory.voidItemReasonLabel,
    reasonPlaceholder: orderHistory.voidItemReasonPlaceholder,
    detailLabel: orderHistory.voidItemReasonDetailLabel,
    detailPlaceholder: orderHistory.voidItemReasonDetailPlaceholder,
    confirmLabel: orderHistory.voidItemReasonConfirm,
    cancelLabel: orderHistory.voidItemReasonCancel,
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
