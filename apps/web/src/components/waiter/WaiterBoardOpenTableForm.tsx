'use client';

import { useCallback, useMemo, useState } from 'react';
import { showToast } from '@/components/ui/Toast';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  isBuffetPackagesEditorReady,
  WaiterBuffetPackagesEditor,
} from '@/components/waiter/WaiterBuffetPackagesEditor';
import { useWaiterTableBuffetForm } from '@/components/waiter/useWaiterTableBuffetForm';
import {
  buffetEntriesFromSnapshot,
  hasActiveBuffetForOrders,
  hasPositiveBuffetSnapshot,
  isBuffetSnapshotUnchanged,
  resolveBuffetFormAlignState,
} from '@/lib/buffet-order';
import { postWaiterBuffetOpenClient } from '@/lib/staff-board-client';
import { commitAuthoritativeWaiterTablePageModel } from '@/lib/waiter-staff-mutation-sync';
import type { UILanguage } from '@/lib/i18n';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { createClient } from '@/lib/supabase/client';
import { WaiterTableIcon } from '@/components/waiter/waiter-table-detail-icons';
import {
  buttonIcon,
  openTableSheetLayout,
  WaiterTablePrimaryButton,
  WaiterTableSecondaryButton,
} from '@/components/waiter/waiter-table-detail-ui';

type Props = {
  model: WaiterTablePageModel;
  restaurant: { id: string; name: string; slug: string };
  tableId: string;
  lang: UILanguage;
  onClose: () => void;
  onSuccess: () => void;
  submitBlocked?: boolean;
};

export function WaiterBoardOpenTableForm({
  model,
  restaurant,
  tableId,
  lang,
  onClose,
  onSuccess,
  submitBlocked = false,
}: Props) {
  const t = WAITER_TEXT[lang];
  const supabase = useMemo(() => createClient(), []);
  const [submitting, setSubmitting] = useState(false);

  const activeBuffets = useMemo(
    () => model.buffets.filter((b) => b.is_active),
    [model.buffets],
  );
  const activeBuffetIds = useMemo(() => activeBuffets.map((b) => b.id), [activeBuffets]);
  const orders = model.detail.orders;
  const sessionMeta = model.detail.sessionMeta;

  const buffetFormAlign = useMemo(
    () =>
      resolveBuffetFormAlignState({
        detailLoaded: true,
        orders,
        activeBuffetIds,
        defaultBuffetId: activeBuffets[0]?.id ?? null,
      }),
    [activeBuffetIds, activeBuffets, orders],
  );

  const {
    guestSnapshot,
    setBuffetGuestCount,
    resolvedByBuffetId,
    priceLoading,
  } = useWaiterTableBuffetForm({
    tableId,
    sessionId: sessionMeta?.sessionId ?? null,
    alignState: buffetFormAlign,
    restaurantId: restaurant.id,
    activeBuffets,
    buffetPricesByBuffetId: model.buffetPricesByBuffetId,
    isDemo: false,
    supabase,
  });

  const buffetActionLabel = hasActiveBuffetForOrders(orders)
    ? t.buffetSaveGuestCounts
    : t.buffetConfirm;

  const editorReady = isBuffetPackagesEditorReady(guestSnapshot, resolvedByBuffetId, priceLoading);
  const saveDisabled = submitting || submitBlocked || !editorReady;

  const handleSubmit = useCallback(async () => {
    if (!hasPositiveBuffetSnapshot(guestSnapshot)) {
      showToast(t.buffetNoRule, 'error');
      return;
    }

    if (isBuffetSnapshotUnchanged(orders, guestSnapshot)) {
      showToast(t.buffetGuestCountsUnchanged, 'info');
      return;
    }

    if (!editorReady) {
      showToast(t.buffetNoRule, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const nextModel = await postWaiterBuffetOpenClient(restaurant.slug, {
        table_id: tableId,
        buffets: buffetEntriesFromSnapshot(guestSnapshot, activeBuffetIds).map((entry) => ({
          buffet_id: entry.buffetId,
          adult_count: entry.adults,
          child_count: entry.children,
        })),
      });
      commitAuthoritativeWaiterTablePageModel(nextModel);
      showToast(t.actionSuccess, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      const apiErr = err as Error & { status?: number; code?: string };
      if (apiErr.status === 409 && apiErr.code === 'session_billing') {
        showToast(t.checkoutLockedHint, 'info');
        return;
      }
      if (apiErr.status === 400 && apiErr.code === 'no_price_rule') {
        showToast(t.buffetNoRule, 'error');
        return;
      }
      showToast(t.actionFailed, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [
    activeBuffetIds,
    editorReady,
    guestSnapshot,
    onClose,
    onSuccess,
    orders,
    restaurant.slug,
    t,
    tableId,
  ]);

  return (
    <div className={openTableSheetLayout.stack}>
      <WaiterBuffetPackagesEditor
        lang={lang}
        activeBuffets={activeBuffets}
        guestSnapshot={guestSnapshot}
        onSetGuestCount={setBuffetGuestCount}
        resolvedByBuffetId={resolvedByBuffetId}
        priceLoading={priceLoading}
        layout="sheet"
      />

      <div className={openTableSheetLayout.actionRow}>
        <WaiterTableSecondaryButton
          type="button"
          onClick={onClose}
          disabled={submitting}
          className={openTableSheetLayout.actionButton}
        >
          {t.closeTableCancel}
        </WaiterTableSecondaryButton>
        <WaiterTablePrimaryButton
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saveDisabled}
          className={openTableSheetLayout.actionButton}
          icon={<WaiterTableIcon className={buttonIcon.sm} />}
        >
          {submitting ? '…' : buffetActionLabel}
        </WaiterTablePrimaryButton>
      </div>
    </div>
  );
}
