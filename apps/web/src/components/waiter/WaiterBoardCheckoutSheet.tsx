'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { CheckoutRequestDetailHost } from '@/components/dashboard/checkout/CheckoutRequestDetailHost';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { getMessages } from '@/lib/i18n/messages';
import { tableIdsEqual } from '@/lib/restaurant-tables';

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantSlug: string;
  tableId: string;
};

export function WaiterBoardCheckoutSheet({
  open,
  onClose,
  restaurantId,
  restaurantSlug,
  tableId,
}: Props) {
  const { requests } = useCheckoutRequests();
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

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

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
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {request ? (
          <CheckoutRequestDetailHost
            key={request.id}
            request={request}
            restaurantId={restaurantId}
            restaurantSlug={restaurantSlug}
            canCloseTable
            showBackButton={false}
            onBack={onClose}
            onAllPaid={onClose}
            onCloseTableComplete={onClose}
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
