'use client';

import { useCallback, useState } from 'react';
import { showToast } from '@/components/ui/Toast';
import { WAITER_TEXT } from '@/components/waiter/waiter-messages';
import {
  buffetOpenSubmitBlockReason,
  postWaiterBuffetOpenAndCommit,
} from '@/lib/waiter-buffet-open-submit';
import type { BuffetGuestSnapshot } from '@/lib/buffet-order';
import type { UILanguage } from '@/lib/i18n';
import type { Order } from '@/types';

export type WaiterBuffetOpenMutationResult = 'success' | 'blocked' | 'failed';

type Params = {
  lang: UILanguage;
  restaurantSlug: string;
  tableId: string;
  orders: Array<Pick<Order, 'items' | 'status'>>;
  guestSnapshot: BuffetGuestSnapshot;
  activeBuffetIds: string[];
  editorReady: boolean;
};

export function useWaiterBuffetOpenMutation({
  lang,
  restaurantSlug,
  tableId,
  orders,
  guestSnapshot,
  activeBuffetIds,
  editorReady,
}: Params) {
  const t = WAITER_TEXT[lang];
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async (): Promise<WaiterBuffetOpenMutationResult> => {
    if (submitting) return 'blocked';

    const blockReason = buffetOpenSubmitBlockReason(orders, guestSnapshot, editorReady);
    if (blockReason === 'empty_snapshot' || blockReason === 'editor_not_ready') {
      showToast(t.buffetNoRule, 'error');
      return 'blocked';
    }
    if (blockReason === 'unchanged') {
      showToast(t.buffetGuestCountsUnchanged, 'info');
      return 'blocked';
    }

    setSubmitting(true);
    const result = await postWaiterBuffetOpenAndCommit({
      restaurantSlug,
      tableId,
      guestSnapshot,
      activeBuffetIds,
    });

    if (!result.ok) {
      setSubmitting(false);
      if (result.status === 409 && result.code === 'session_billing') {
        showToast(t.checkoutLockedHint, 'info');
        return 'failed';
      }
      if (result.status === 400 && result.code === 'no_price_rule') {
        showToast(t.buffetNoRule, 'error');
        return 'failed';
      }
      showToast(t.actionFailed, 'error');
      return 'failed';
    }

    showToast(t.actionSuccess, 'success');
    return 'success';
  }, [
    activeBuffetIds,
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
