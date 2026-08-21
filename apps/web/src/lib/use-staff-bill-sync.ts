'use client';

import { useCallback, useEffect, useState } from 'react';
import { mintBrowserUuid } from '@/lib/browser-uuid';
import { showToast } from '@/components/ui/Toast';

type BillSyncJob = {
  id: string;
  status: string;
  request_id?: string;
  error_code?: string | null;
  error_message?: string | null;
  content_fingerprint?: string | null;
};

type Labels = {
  syncBillComplete: string;
  syncBillFailed: string;
  syncBillDisabled: string;
  syncBillUnchanged: string;
};

/**
 * Sole checkout client for fiscal bill-sync enqueue + status wait (no interval polling).
 * Retries status with short backoff only after an explicit Sync click.
 * After succeeded, blocks until contentRevision changes (server still enforces fingerprint).
 */
export function useStaffBillSync(input: {
  restaurantSlug: string;
  billSplitId: string;
  /** Feature + checkout.sync_bill — when false, hide entry. */
  enabled: boolean;
  /** Host bill revision; when it changes after a success lock, re-enable Sync. */
  contentRevision: string;
  /**
   * True after the host has finished the first orders load for this bill.
   * Prevents locking to an empty pre-load revision then unlocking when lines arrive.
   */
  contentReady: boolean;
  labels: Labels;
}) {
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<BillSyncJob | null>(null);
  const [available, setAvailable] = useState(input.enabled);
  /** Revision captured when we treat the bill as already synced (succeeded). */
  const [lockedRevision, setLockedRevision] = useState<string | null>(null);

  const refreshLatest = useCallback(async () => {
    if (!input.enabled) {
      setAvailable(false);
      return null;
    }
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(input.restaurantSlug)}/bill-syncs?source_sale_id=${encodeURIComponent(input.billSplitId)}`,
      { credentials: 'include' },
    );
    if (res.status === 403) {
      setAvailable(false);
      return null;
    }
    setAvailable(true);
    if (!res.ok) return null;
    const data = (await res.json()) as { job?: BillSyncJob | null };
    const next = data.job ?? null;
    setJob(next);
    return next;
  }, [input.billSplitId, input.enabled, input.restaurantSlug]);

  useEffect(() => {
    void refreshLatest();
  }, [refreshLatest]);

  useEffect(() => {
    setLockedRevision(null);
    setJob(null);
  }, [input.billSplitId]);

  useEffect(() => {
    if (!input.contentReady) return;
    if (job?.status !== 'succeeded') return;
    setLockedRevision((prev) => (prev == null ? input.contentRevision : prev));
  }, [input.contentReady, input.contentRevision, job?.status]);

  const waitUntilSettled = useCallback(
    async (requestId: string) => {
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 400 + i * 150));
        const latest = await refreshLatest();
        if (!latest) continue;
        if (latest.request_id && latest.request_id !== requestId) continue;
        if (latest.status === 'succeeded' || latest.status === 'failed') return latest;
      }
      return refreshLatest();
    },
    [refreshLatest],
  );

  const inFlight = job?.status === 'pending' || job?.status === 'processing';
  const unchangedLock =
    job?.status === 'succeeded' &&
    lockedRevision != null &&
    lockedRevision === input.contentRevision;
  const syncBillBlocked = Boolean(busy || inFlight || unchangedLock);

  const syncBill = useCallback(async () => {
    if (!available || syncBillBlocked) return;
    setBusy(true);
    const requestId = mintBrowserUuid();
    try {
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(input.restaurantSlug)}/bill-syncs`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bill_split_id: input.billSplitId,
            request_id: requestId,
          }),
        },
      );
      if (res.status === 403) {
        setAvailable(false);
        showToast(input.labels.syncBillDisabled, 'error');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        job?: BillSyncJob;
      };
      if (res.status === 409 && data.error === 'already_synced') {
        if (data.job) setJob(data.job);
        setLockedRevision(input.contentRevision);
        showToast(input.labels.syncBillUnchanged, 'info');
        return;
      }
      if (!res.ok) {
        showToast(data.message || data.error || input.labels.syncBillFailed, 'error');
        return;
      }
      if (data.job) setJob(data.job);
      const settled = await waitUntilSettled(requestId);
      if (settled?.status === 'succeeded') {
        setLockedRevision(input.contentRevision);
        showToast(input.labels.syncBillComplete, 'success');
      } else if (settled?.status === 'failed') {
        showToast(
          settled.error_message || settled.error_code || input.labels.syncBillFailed,
          'error',
        );
      } else {
        showToast(input.labels.syncBillFailed, 'error');
      }
    } catch {
      showToast(input.labels.syncBillFailed, 'error');
    } finally {
      setBusy(false);
    }
  }, [available, input, syncBillBlocked, waitUntilSettled]);

  return {
    billSyncAvailable: available,
    billSyncBusy: busy,
    billSyncBlocked: syncBillBlocked,
    billSyncJob: job,
    syncBill,
  };
}
