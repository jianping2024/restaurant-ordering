'use client';

import { useCallback, useMemo } from 'react';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  isBuffetPackagesEditorReady,
  WaiterBuffetPackagesEditor,
} from '@/components/waiter/WaiterBuffetPackagesEditor';
import { useWaiterTableBuffetForm } from '@/components/waiter/useWaiterTableBuffetForm';
import { useWaiterBuffetOpenMutation } from '@/components/waiter/useWaiterBuffetOpenMutation';
import { resolveBuffetFormAlignState } from '@/lib/buffet-order';
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
};

export function WaiterBoardOpenTableForm({
  model,
  restaurant,
  tableId,
  lang,
  onClose,
  onSuccess,
}: Props) {
  const t = WAITER_TEXT[lang];
  const supabase = useMemo(() => createClient(), []);

  const activeBuffets = useMemo(
    () => model.buffets.filter((b) => b.is_active),
    [model.buffets],
  );
  const activeBuffetIds = useMemo(() => activeBuffets.map((b) => b.id), [activeBuffets]);

  const buffetFormAlign = useMemo(
    () =>
      resolveBuffetFormAlignState({
        detailLoaded: true,
        hasOpenSession: false,
        orders: [],
        activeBuffetIds,
        defaultBuffetId: activeBuffets[0]?.id ?? null,
      }),
    [activeBuffetIds, activeBuffets],
  );

  const {
    guestSnapshot,
    setBuffetGuestCount,
    resolvedByBuffetId,
    priceLoading,
  } = useWaiterTableBuffetForm({
    tableId,
    sessionId: null,
    alignState: buffetFormAlign,
    restaurantId: restaurant.id,
    activeBuffets,
    buffetPricesByBuffetId: model.buffetPricesByBuffetId,
    isDemo: false,
    supabase,
    lifecycle: 'ephemeral',
  });

  const editorReady = isBuffetPackagesEditorReady(guestSnapshot, resolvedByBuffetId, priceLoading);

  const { submitting, submit } = useWaiterBuffetOpenMutation({
    lang,
    restaurantSlug: restaurant.slug,
    tableId,
    orders: [],
    guestSnapshot,
    activeBuffetIds,
    hasOpenSession: false,
    editorReady,
  });

  const saveDisabled = submitting || !editorReady;

  const handleSubmit = useCallback(async () => {
    const result = await submit();
    if (result === 'success' || result === 'already_open') {
      onSuccess();
      onClose();
    }
  }, [onClose, onSuccess, submit]);

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
          loading={submitting}
          className={openTableSheetLayout.actionButton}
          icon={<WaiterTableIcon className={buttonIcon.sm} />}
        >
          {t.buffetConfirm}
        </WaiterTablePrimaryButton>
      </div>
    </div>
  );
}
