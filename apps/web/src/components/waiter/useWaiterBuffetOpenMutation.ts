'use client';

import { useCallback, useState } from 'react';
import { showToast } from '@/components/ui/Toast';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  buffetOpenSubmitBlockReason,
  postWaiterBuffetOpenAndCommit,
  precheckIdleOpenTable,
} from '@/lib/waiter-buffet-open-submit';
import { toastWaiterBuffetOpenFailure } from '@/lib/waiter-buffet-open-failure-toast';
import type { BuffetGuestSnapshot } from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import type { Order } from '@/types';

export type WaiterBuffetOpenMutationResult =
  | { kind: 'success'; model: WaiterTablePageModel }
  | { kind: 'already_open' }
  | { kind: 'blocked' }
  | { kind: 'failed' };

type Params = {
  lang: UILanguage;
  restaurantSlug: string;
  tableId: string;
  orders: Array<Pick<Order, 'items' | 'status'>>;
  guestSnapshot: BuffetGuestSnapshot;
  activeBuffetIds: string[];
  hasOpenSession: boolean;
  editorReady: boolean;
};

export function useWaiterBuffetOpenMutation({
  lang,
  restaurantSlug,
  tableId,
  orders,
  guestSnapshot,
  activeBuffetIds,
  hasOpenSession,
  editorReady,
}: Params) {
  const t = WAITER_TEXT[lang];
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async (): Promise<WaiterBuffetOpenMutationResult> => {
    if (submitting) return { kind: 'blocked' };

    const blockReason = buffetOpenSubmitBlockReason(
      orders,
      guestSnapshot,
      activeBuffetIds,
      editorReady,
      hasOpenSession,
    );
    if (blockReason === 'editor_not_ready') {
      showToast(t.buffetNoRule, 'error');
      return { kind: 'blocked' };
    }
    if (blockReason === 'unchanged') {
      showToast(t.buffetGuestCountsUnchanged, 'info');
      return { kind: 'blocked' };
    }

    setSubmitting(true);

    if (!hasOpenSession) {
      const precheck = await precheckIdleOpenTable(restaurantSlug, tableId);
      if (precheck === 'already_open') {
        setSubmitting(false);
        showToast(t.refreshHint, 'info');
        return { kind: 'already_open' };
      }
      if (precheck === 'unavailable') {
        setSubmitting(false);
        showToast(t.actionFailed, 'error');
        return { kind: 'failed' };
      }
    }

    const result = await postWaiterBuffetOpenAndCommit({
      restaurantSlug,
      tableId,
      guestSnapshot,
      activeBuffetIds,
    });

    if (!result.ok) {
      setSubmitting(false);
      toastWaiterBuffetOpenFailure(t, result);
      return { kind: 'failed' };
    }

    showToast(t.actionSuccess, 'success');
    return { kind: 'success', model: result.model };
  }, [
    activeBuffetIds,
    hasOpenSession,
    editorReady,
    guestSnapshot,
    orders,
    restaurantSlug,
    submitting,
    t,
    tableId,
  ]);

  return { submitting, submit };
}
