'use client';

import { useMemo } from 'react';
import { ReasonConfirmDialog } from '@/components/ui/ReasonConfirmDialog';
import type { UILanguage } from '@/lib/i18n';
import {
  voidItemReasonDialogCopy,
  voidItemReasonDialogTitle,
  voidItemWasServed,
} from '@/lib/order-item-void/void-item-reason-ui';
import type { OrderItem } from '@/types';

export interface VoidItemReasonDialogProps {
  open: boolean;
  onClose: () => void;
  lang: UILanguage;
  item: Pick<OrderItem, 'emoji' | 'name' | 'name_pt' | 'item_status'> | null;
  onConfirm: (reason: string, detail: string) => void | Promise<void>;
  confirming?: boolean;
  externalError?: string | null;
}

export function VoidItemReasonDialog({
  open,
  onClose,
  lang,
  item,
  onConfirm,
  confirming = false,
  externalError = null,
}: VoidItemReasonDialogProps) {
  const copy = useMemo(() => voidItemReasonDialogCopy(lang), [lang]);
  const title = useMemo(() => voidItemReasonDialogTitle(lang, item), [lang, item]);
  const served = item ? voidItemWasServed(item) : false;

  return (
    <ReasonConfirmDialog
      open={open}
      onClose={onClose}
      title={title}
      message={copy.message}
      reasonLabel={copy.reasonLabel}
      reasonPlaceholder={copy.reasonPlaceholder}
      reasonFieldVariant="compact"
      detailLabel={copy.detailLabel}
      detailPlaceholder={copy.detailPlaceholder}
      confirmLabel={copy.confirmLabel}
      cancelLabel={copy.cancelLabel}
      reasonRequiredError={copy.reasonRequiredError}
      detailRequiredError={copy.detailRequiredError}
      reasons={copy.reasons}
      reasonGroup="void_item"
      voidItemWasServed={served}
      confirming={confirming}
      externalError={externalError}
      onConfirm={onConfirm}
    />
  );
}
