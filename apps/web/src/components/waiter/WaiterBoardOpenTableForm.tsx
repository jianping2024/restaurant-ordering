'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  isBuffetPackagesEditorReady,
  WaiterBuffetPackagesEditor,
} from '@/components/waiter/WaiterBuffetPackagesEditor';
import { useWaiterTableBuffetForm } from '@/components/waiter/useWaiterTableBuffetForm';
import { useWaiterBuffetOpenMutation } from '@/components/waiter/useWaiterBuffetOpenMutation';
import {
  pickableBuffetOptions,
  useWaiterOpenableBuffetIds,
  type WaiterOpenableState,
} from '@/components/waiter/useWaiterOpenableBuffetIds';
import {
  buffetGuestRuleForDraft,
  resolveBuffetFormAlignState,
} from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { openTableSheetLayout } from '@/components/waiter/waiter-table-detail-ui';

/** Footer controls owned by the sheet Modal (pinned); form only reports busy / ready / submit. */
export type WaiterBoardOpenTableFooterActions = {
  busy: boolean;
  confirmDisabled: boolean;
  onConfirm: () => void;
};

type Props = {
  model: WaiterTablePageModel;
  restaurant: { id: string; name: string; slug: string };
  tableId: string;
  lang: UILanguage;
  onClose: () => void;
  onOpenTableSuccess: (model: WaiterTablePageModel) => void;
  onStaleBoard: () => void;
  onFooterActionsChange: (actions: WaiterBoardOpenTableFooterActions | null) => void;
  /**
   * Board-prefetched「当前可开套餐」snapshot. When passed, this form does not start its own
   * fetch (board already owns `useWaiterOpenableBuffetIds`); it re-checks the version once
   * when the sheet opens so settings changed since the board loaded are picked up.
   */
  boardOpenable?: WaiterOpenableState;
};

export function WaiterBoardOpenTableForm({
  model,
  restaurant,
  tableId,
  lang,
  onClose,
  onOpenTableSuccess,
  onStaleBoard,
  onFooterActionsChange,
  boardOpenable,
}: Props) {
  const activeBuffets = useMemo(
    () => model.buffets.filter((b) => b.is_active),
    [model.buffets],
  );
  const localOpenable = useWaiterOpenableBuffetIds(
    restaurant.id,
    restaurant.slug,
    boardOpenable === undefined,
  );
  const {
    openableBuffetIds,
    openablePricesByBuffetId,
    openableMinGuestCountByBuffetId,
    refreshOpenableBuffetIds,
  } = boardOpenable ?? localOpenable;
  // Sheet open = one version compare against the board's snapshot (lifecycle one-shot,
  // `unchanged` when nothing moved). The local hook already ensures on mount.
  const refreshBoardOpenable = boardOpenable?.refreshOpenableBuffetIds;
  useEffect(() => {
    if (refreshBoardOpenable) void refreshBoardOpenable();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per sheet open
  }, []);
  const buffetOptions = useMemo(
    () =>
      pickableBuffetOptions(activeBuffets, openableBuffetIds, null, openableMinGuestCountByBuffetId),
    [activeBuffets, openableBuffetIds, openableMinGuestCountByBuffetId],
  );

  const buffetFormAlign = useMemo(
    () =>
      resolveBuffetFormAlignState({
        detailLoaded: true,
        hasOpenSession: false,
        orders: [],
        defaultBuffetId: buffetOptions[0]?.id ?? null,
      }),
    [buffetOptions],
  );

  const {
    draft,
    selectBuffet,
    setBuffetGuestCount,
    resolvedByBuffetId,
    priceLoading,
  } = useWaiterTableBuffetForm({
    tableId,
    sessionId: null,
    alignState: buffetFormAlign,
    activeBuffets: buffetOptions,
    buffetPricesByBuffetId: openablePricesByBuffetId,
  });

  const editorReady = isBuffetPackagesEditorReady(draft, resolvedByBuffetId, priceLoading);

  /**
   * One paint gate: openable list + prices + default draft are all settled.
   * Until then the editor shows only the loading line (no price text flicker).
   */
  const sheetContentReady =
    openableBuffetIds != null
    && !priceLoading
    && (buffetOptions.length === 0 || draft != null);

  const { submitting, submit } = useWaiterBuffetOpenMutation({
    lang,
    restaurantSlug: restaurant.slug,
    tableId,
    orders: [],
    draft,
    hasOpenSession: false,
    editorReady,
    guestRule: buffetGuestRuleForDraft(draft, buffetOptions, resolvedByBuffetId),
    onStaleConflict: refreshOpenableBuffetIds,
  });

  const handleSubmit = useCallback(async () => {
    const result = await submit();
    if (result.kind === 'success') {
      onOpenTableSuccess(result.model);
      onClose();
      return;
    }
    if (result.kind === 'already_open') {
      onStaleBoard();
      onClose();
    }
  }, [onClose, onOpenTableSuccess, onStaleBoard, submit]);

  useLayoutEffect(() => {
    onFooterActionsChange({
      busy: submitting,
      confirmDisabled: !editorReady,
      onConfirm: () => {
        void handleSubmit();
      },
    });
    return () => onFooterActionsChange(null);
  }, [editorReady, handleSubmit, onFooterActionsChange, submitting]);

  return (
    <div className={openTableSheetLayout.stack}>
      <WaiterBuffetPackagesEditor
        lang={lang}
        buffetOptions={buffetOptions}
        openableLoaded={sheetContentReady}
        draft={draft}
        onSelectBuffet={selectBuffet}
        onSetGuestCount={setBuffetGuestCount}
        resolvedByBuffetId={resolvedByBuffetId}
        priceLoading={priceLoading}
        layout="sheet"
      />
    </div>
  );
}
