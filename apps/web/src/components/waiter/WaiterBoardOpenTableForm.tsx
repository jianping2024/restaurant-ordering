'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Buffet } from '@/types';
import { showToast } from '@/components/ui/Toast';
import {
  BuffetGuestCounter,
  BuffetPriceMeta,
} from '@/components/waiter/WaiterTableDetailLayout';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import { useWaiterTableBuffetForm } from '@/components/waiter/useWaiterTableBuffetForm';
import {
  aggregateBuffetForOrders,
  buildBuffetBaseLine,
  formatBuffetPriceTemplate,
  isBuffetGuestCountsUnchanged,
  resolveBuffetFormAlignState,
  resolveBuffetOpenPricePreview,
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
  const orders = model.detail.orders;
  const sessionMeta = model.detail.sessionMeta;

  const buffetFormAlign = useMemo(
    () =>
      resolveBuffetFormAlignState({
        detailLoaded: true,
        orders,
        defaultBuffetId: activeBuffets[0]?.id ?? null,
      }),
    [activeBuffets, orders],
  );

  const {
    buffetId,
    setBuffetId,
    selectedBuffet,
    buffetAdults,
    buffetChildren,
    setBuffetGuestCount,
    buffetResolved,
    buffetPriceLoading,
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

  const buffetPriceDisplay = useMemo(
    () => resolveBuffetOpenPricePreview(buffetResolved, buffetAdults, buffetChildren),
    [buffetResolved, buffetAdults, buffetChildren],
  );

  const buffetActionLabel = aggregateBuffetForOrders(orders)
    ? t.buffetSaveGuestCounts
    : t.buffetConfirm;

  const saveDisabled = submitting || submitBlocked || buffetPriceLoading || !buffetPriceDisplay.ok;

  const handleSubmit = useCallback(async () => {
    if (!buffetId || !selectedBuffet) return;
    if (isBuffetGuestCountsUnchanged(orders, buffetId, buffetAdults, buffetChildren)) {
      showToast(t.buffetGuestCountsUnchanged, 'info');
      return;
    }
    if (!buffetResolved) {
      showToast(t.buffetNoRule, 'error');
      return;
    }
    const line = buildBuffetBaseLine({
      buffet: selectedBuffet,
      adultCount: buffetAdults,
      childCount: buffetChildren,
      resolved: buffetResolved,
    });
    if (!line) {
      showToast(t.buffetNoRule, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const nextModel = await postWaiterBuffetOpenClient(restaurant.slug, {
        table_id: tableId,
        buffet_id: buffetId,
        adult_count: buffetAdults,
        child_count: buffetChildren,
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
    buffetAdults,
    buffetChildren,
    buffetId,
    buffetResolved,
    onClose,
    onSuccess,
    orders,
    restaurant.slug,
    selectedBuffet,
    t,
    tableId,
  ]);

  return (
    <div className={openTableSheetLayout.stack}>
      <BuffetPicker
        t={t}
        activeBuffets={activeBuffets}
        selectedBuffet={selectedBuffet}
        buffetId={buffetId}
        onBuffetIdChange={setBuffetId}
        buffetPriceLoading={buffetPriceLoading}
        buffetPriceDisplay={buffetPriceDisplay}
      />

      <div className={openTableSheetLayout.guestBlock}>
        <BuffetGuestCounter
          layout="sheet"
          label={t.buffetAdults}
          qty={buffetAdults}
          onQtyChange={(value) => setBuffetGuestCount('adults', value)}
          onDecrement={() => setBuffetGuestCount('adults', buffetAdults - 1)}
          onIncrement={() => setBuffetGuestCount('adults', buffetAdults + 1)}
        />
        <BuffetGuestCounter
          layout="sheet"
          label={t.buffetChildren}
          qty={buffetChildren}
          onQtyChange={(value) => setBuffetGuestCount('children', value)}
          onDecrement={() => setBuffetGuestCount('children', buffetChildren - 1)}
          onIncrement={() => setBuffetGuestCount('children', buffetChildren + 1)}
        />
      </div>

      {buffetPriceDisplay.ok ? (
        <p className={openTableSheetLayout.total}>
          {formatBuffetPriceTemplate(t.buffetEstimatedTotal, {
            total: buffetPriceDisplay.subtotal,
          })}
        </p>
      ) : null}

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

function BuffetPicker({
  t,
  activeBuffets,
  selectedBuffet,
  buffetId,
  onBuffetIdChange,
  buffetPriceLoading,
  buffetPriceDisplay,
}: {
  t: (typeof WAITER_TEXT)[keyof typeof WAITER_TEXT];
  activeBuffets: Buffet[];
  selectedBuffet: Buffet | null;
  buffetId: string;
  onBuffetIdChange: (id: string) => void;
  buffetPriceLoading: boolean;
  buffetPriceDisplay: ReturnType<typeof resolveBuffetOpenPricePreview>;
}) {
  return (
    <div className={openTableSheetLayout.buffetHeader}>
      {activeBuffets.length === 1 ? (
        <p className="text-[15px] font-semibold text-brand-text leading-snug">{selectedBuffet?.name}</p>
      ) : (
        <select
          value={buffetId}
          onChange={(e) => onBuffetIdChange(e.target.value)}
          aria-label={t.buffetBlock}
          className="block w-full rounded-lg bg-brand-bg border border-brand-border px-2.5 py-2 text-[15px] font-semibold text-brand-text"
        >
          {activeBuffets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
      <BuffetPriceMeta t={t} buffetPriceLoading={buffetPriceLoading} buffetPriceDisplay={buffetPriceDisplay} />
    </div>
  );
}
