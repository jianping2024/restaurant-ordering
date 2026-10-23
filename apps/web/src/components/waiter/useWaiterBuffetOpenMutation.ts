'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '@/components/ui/Toast';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  BUFFET_OPEN_ALREADY_OPEN,
  buffetOpenSubmitBlockReason,
  buffetWaiterOpenIntentFromSession,
  postWaiterBuffetOpenAndCommit,
} from '@/lib/waiter-buffet-open-submit';
import { toastWaiterBuffetOpenFailure } from '@/lib/waiter-buffet-open-failure-toast';
import { buffetDraftClearsHeadcount, type BuffetGuestSnapshot } from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import type { Order } from '@/types';

/** Occupied-table headcount: debounce −/+ taps into one intent=save POST. */
const BUFFET_GUEST_AUTOSAVE_DEBOUNCE_MS = 400;

export type WaiterBuffetOpenMutationResult =
  | { kind: 'success'; model: WaiterTablePageModel }
  | { kind: 'already_open' }
  | { kind: 'blocked' }
  | { kind: 'failed' };

/** explicit = cold open confirm (toasts); silent = occupied autosave (fail toasts only). */
export type WaiterBuffetPersistFeedback = 'explicit' | 'silent';

type Params = {
  lang: UILanguage;
  restaurantSlug: string;
  tableId: string;
  orders: Array<Pick<Order, 'items' | 'status'>>;
  guestSnapshot: BuffetGuestSnapshot;
  activeBuffetIds: string[];
  hasOpenSession: boolean;
  editorReady: boolean;
  /**
   * Occupied table: `scheduleAutosave` (called only from a −/+ tap) persists after debounce.
   * Cold open / board sheet: false — only explicit submit.
   */
  autosave?: boolean;
  /**
   * Autosave held because the edit would clear an occupied table's headcount to 0.
   * Caller confirms (`submit`) or discards the edit.
   */
  onZeroHeadcountHeld?: () => void;
  onSuccess?: (model: WaiterTablePageModel) => void;
  onStaleConflict?: () => void | Promise<void>;
};

/**
 * Sole client persist for POST …/staff/waiter/buffet (confirm open + occupied autosave).
 * Board sheet and table detail both use this hook — no parallel applyBuffetToTable.
 */
export function useWaiterBuffetOpenMutation({
  lang,
  restaurantSlug,
  tableId,
  orders,
  guestSnapshot,
  activeBuffetIds,
  hasOpenSession,
  editorReady,
  autosave = false,
  onZeroHeadcountHeld,
  onSuccess,
  onStaleConflict,
}: Params) {
  const t = WAITER_TEXT[lang];
  const [submitting, setSubmitting] = useState(false);

  const ordersRef = useRef(orders);
  const guestSnapshotRef = useRef(guestSnapshot);
  const activeBuffetIdsRef = useRef(activeBuffetIds);
  const hasOpenSessionRef = useRef(hasOpenSession);
  const editorReadyRef = useRef(editorReady);
  const autosaveRef = useRef(autosave);
  const onZeroHeadcountHeldRef = useRef(onZeroHeadcountHeld);
  const onSuccessRef = useRef(onSuccess);
  const onStaleConflictRef = useRef(onStaleConflict);
  const inFlightRef = useRef(false);
  const retriggerRef = useRef(false);

  ordersRef.current = orders;
  guestSnapshotRef.current = guestSnapshot;
  activeBuffetIdsRef.current = activeBuffetIds;
  hasOpenSessionRef.current = hasOpenSession;
  editorReadyRef.current = editorReady;
  autosaveRef.current = autosave;
  onZeroHeadcountHeldRef.current = onZeroHeadcountHeld;
  onSuccessRef.current = onSuccess;
  onStaleConflictRef.current = onStaleConflict;

  const persist = useCallback(
    async (feedback: WaiterBuffetPersistFeedback): Promise<WaiterBuffetOpenMutationResult> => {
      if (inFlightRef.current) {
        retriggerRef.current = true;
        return { kind: 'blocked' };
      }

      inFlightRef.current = true;
      setSubmitting(true);
      let outcome: WaiterBuffetOpenMutationResult = { kind: 'blocked' };

      try {
        do {
          retriggerRef.current = false;
          const blockReason = buffetOpenSubmitBlockReason(
            ordersRef.current,
            guestSnapshotRef.current,
            activeBuffetIdsRef.current,
            editorReadyRef.current,
            hasOpenSessionRef.current,
          );
          if (blockReason === 'editor_not_ready') {
            if (feedback === 'explicit') showToast(t.buffetNoRule, 'error');
            outcome = { kind: 'blocked' };
            break;
          }
          if (blockReason === 'unchanged') {
            outcome = { kind: 'blocked' };
            break;
          }

          const result = await postWaiterBuffetOpenAndCommit({
            restaurantSlug,
            tableId,
            guestSnapshot: guestSnapshotRef.current,
            activeBuffetIds: activeBuffetIdsRef.current,
            intent: buffetWaiterOpenIntentFromSession(hasOpenSessionRef.current),
          });

          if (!result.ok) {
            toastWaiterBuffetOpenFailure(t, result);
            if (result.code === BUFFET_OPEN_ALREADY_OPEN) {
              await onStaleConflictRef.current?.();
              outcome = { kind: 'already_open' };
              break;
            }
            if (result.status === 409) {
              await onStaleConflictRef.current?.();
            }
            outcome = { kind: 'failed' };
            break;
          }

          onSuccessRef.current?.(result.model);
          if (feedback === 'explicit') {
            showToast(t.actionSuccess, 'success');
          }
          outcome = { kind: 'success', model: result.model };
        } while (retriggerRef.current);
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }

      return outcome;
    },
    [restaurantSlug, t, tableId],
  );

  const submit = useCallback(
    () => persist('explicit'),
    [persist],
  );

  const autosaveTimerRef = useRef<number | null>(null);
  const cancelAutosave = useCallback(() => {
    if (autosaveTimerRef.current == null) return;
    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = null;
  }, []);

  /**
   * Sole autosave trigger — call only from a user −/+ tap. Loads, refreshes and
   * Realtime realigns never save (they can briefly paint a draft that lags orders).
   */
  const scheduleAutosave = useCallback(() => {
    if (!autosaveRef.current) return;
    cancelAutosave();
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      if (!autosaveRef.current) return;
      if (
        buffetDraftClearsHeadcount(
          ordersRef.current,
          guestSnapshotRef.current,
          activeBuffetIdsRef.current,
        )
      ) {
        onZeroHeadcountHeldRef.current?.();
        return;
      }
      void persist('silent');
    }, BUFFET_GUEST_AUTOSAVE_DEBOUNCE_MS);
  }, [cancelAutosave, persist]);

  // A pending tap belongs to this table only; drop it on table switch / unmount / autosave off.
  useEffect(() => cancelAutosave, [cancelAutosave, tableId]);
  useEffect(() => {
    if (!autosave) cancelAutosave();
  }, [autosave, cancelAutosave]);

  return { submitting, submit, scheduleAutosave };
}
