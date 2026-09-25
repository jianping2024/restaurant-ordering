'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { CheckoutRequestDetailHost } from '@/components/dashboard/checkout/CheckoutRequestDetailHost';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { getMessages } from '@/lib/i18n/messages';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';
import { tableIdsEqual } from '@/lib/restaurant-tables';
import { checkoutSettlementBarSheetStickyShellClass } from '@/lib/waiter-staff-sticky-chrome';
import type { Capabilities } from '@/lib/permissions/can';

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantSlug: string;
  tableId: string;
  capabilities: Capabilities;
  billSyncToFiscal?: boolean;
};

export function WaiterBoardCheckoutSheet({
  open,
  onClose,
  restaurantId,
  restaurantSlug,
  tableId,
  capabilities,
  billSyncToFiscal = false,
}: Props) {
  const { requests, printAsk } = useCheckoutRequests();
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const navT = getMessages(lang).nav;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close the sheet after the provider-level print question finishes for this table.
  useEffect(() => {
    if (!open) return;
    if (printAsk) return;
    if (requests.some((row) => tableIdsEqual(row.table_id, tableId))) return;
    onClose();
  }, [open, printAsk, requests, tableId, onClose]);

  useBodyScrollLock(open);

  const request = useMemo(
    () => requests.find((row) => tableIdsEqual(row.table_id, tableId)),
    [requests, tableId],
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-bg">
      <header className="flex shrink-0 items-center gap-3 border-b border-brand-border bg-brand-card px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-brand-gold hover:underline"
        >
          ← {navT.viewWaiter}
        </button>
        <p className="text-xs text-brand-text-muted">{t.title}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
        {request ? (
          <CheckoutRequestDetailHost
            key={request.id}
            request={request}
            restaurantId={restaurantId}
            restaurantSlug={restaurantSlug}
            capabilities={capabilities}
            billSyncToFiscal={billSyncToFiscal}
            showBackButton={false}
            stickyShellClass={checkoutSettlementBarSheetStickyShellClass}
            onBack={onClose}
          />
        ) : (
          <div className="rounded-xl border border-brand-border bg-brand-card px-6 py-16 text-center">
            <p className="font-heading text-lg text-brand-text">{t.emptyTitle}</p>
            <p className="text-brand-text-muted text-sm mt-2">{t.emptyHint}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
