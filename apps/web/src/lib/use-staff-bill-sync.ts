'use client';

import { useCallback, useEffect, useState } from 'react';
import { showToast } from '@/components/ui/Toast';
import { runStaffSyncAndCheckoutClose } from '@/lib/run-staff-sync-and-checkout-close';
import {
  fetchStaffBillSyncStatus,
  type StaffBillSyncJob,
} from '@/lib/staff-bill-sync-client';

type Labels = {
  syncBillComplete: string;
  syncBillFailed: string;
  syncBillDisabled: string;
  syncBillDirty: string;
  syncBillCloseFailed: string;
  syncBillClosePrintFailed: string;
  syncBillCloseSuccess: string;
};

/**
 * Checkout detail status + sole compound action runner (sync → fingerprint → close).
 * Block while busy / in-flight only — content_unchanged still allows close.
 */
export function useStaffBillSync(input: {
  restaurantSlug: string;
  billSplitId: string;
  tableId: string;
  /** Feature + maySyncAndCheckoutClose — when false, hide entry. */
  enabled: boolean;
  printBillOnClose: boolean;
  /**
   * Host bumps when the checkout bill may have changed (total / request / orders).
   * Triggers a one-shot GET for content_unchanged — not polling.
   */
  refreshKey: string;
  labels: Labels;
  onClosed?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<StaffBillSyncJob | null>(null);
  const [available, setAvailable] = useState(input.enabled);
  const [contentUnchanged, setContentUnchanged] = useState(false);

  const refreshLatest = useCallback(async () => {
    if (!input.enabled) {
      setAvailable(false);
      setContentUnchanged(false);
      return null;
    }
    const status = await fetchStaffBillSyncStatus({
      restaurantSlug: input.restaurantSlug,
      billSplitId: input.billSplitId,
    });
    if (!status.available) {
      setAvailable(false);
      setContentUnchanged(false);
      return null;
    }
    setAvailable(true);
    setJob(status.job);
    setContentUnchanged(status.content_unchanged);
    return status.job;
  }, [input.billSplitId, input.enabled, input.restaurantSlug]);

  useEffect(() => {
    setJob(null);
    setContentUnchanged(false);
  }, [input.billSplitId]);

  useEffect(() => {
    void refreshLatest();
  }, [refreshLatest, input.refreshKey]);

  const inFlight = job?.status === 'pending' || job?.status === 'processing';
  const syncBillBlocked = Boolean(busy || inFlight);

  const syncAndCheckoutClose = useCallback(async () => {
    if (!available || syncBillBlocked) return;
    setBusy(true);
    try {
      const outcome = await runStaffSyncAndCheckoutClose({
        restaurantSlug: input.restaurantSlug,
        billSplitId: input.billSplitId,
        tableId: input.tableId,
        printBill: input.printBillOnClose,
      });
      if (!outcome.ok) {
        if (outcome.code === 'bill_sync_disabled' || outcome.code === 'forbidden') {
          setAvailable(false);
          showToast(input.labels.syncBillDisabled, 'error');
          return;
        }
        if (outcome.stage === 'dirty') {
          showToast(input.labels.syncBillDirty, 'error');
          await refreshLatest();
          return;
        }
        if (outcome.stage === 'close') {
          showToast(input.labels.syncBillCloseFailed, 'error');
          return;
        }
        showToast(
          outcome.message || outcome.job?.error_message || input.labels.syncBillFailed,
          'error',
        );
        await refreshLatest();
        return;
      }
      showToast(input.labels.syncBillCloseSuccess, 'success');
      if (outcome.printFailed) {
        showToast(input.labels.syncBillClosePrintFailed, 'error');
      }
      input.onClosed?.();
    } catch {
      showToast(input.labels.syncBillFailed, 'error');
    } finally {
      setBusy(false);
    }
  }, [available, input, refreshLatest, syncBillBlocked]);

  return {
    billSyncAvailable: available,
    billSyncBusy: busy,
    billSyncBlocked: syncBillBlocked,
    billSyncContentUnchanged: contentUnchanged,
    billSyncJob: job,
    syncAndCheckoutClose,
  };
}
