'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { OrderHistoryBillDetailPanel } from '@/components/dashboard/OrderHistoryBillDetailPanel';
import { Modal } from '@/components/ui/Modal';
import { getMessages } from '@/lib/i18n/messages';
import type { OrderHistoryEntry } from '@/lib/order-history/types';

interface Props {
  entry: OrderHistoryEntry | null;
  itemCodeByMenuId: Record<string, string>;
  onClose: () => void;
}

export function OrderHistoryDetailModal({ entry, itemCodeByMenuId, onClose }: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;

  if (!entry) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${i18n.table} ${entry.displayName}`}
      size="lg"
    >
      <div className="space-y-4 px-4 pb-5 pt-1 sm:px-6 sm:pb-6">
        <div className="text-sm text-brand-text-muted">
          {new Date(entry.closedAt).toLocaleString()}
          {entry.openedByName ? (
            <>
              <span className="mx-2 text-brand-text-muted/50" aria-hidden>
                ·
              </span>
              {i18n.openedBy} {entry.openedByName}
            </>
          ) : null}
        </div>

        <OrderHistoryBillDetailPanel
          entry={entry}
          itemCodeByMenuId={itemCodeByMenuId}
          lang={lang}
        />
      </div>
    </Modal>
  );
}
