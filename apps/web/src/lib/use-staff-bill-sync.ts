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
 * Block Sync only when server says content_unchanged (or busy / in-flight).
 */
export function useStaffBillSync(input: {
  restaurantSlug: string;
  billSplitId: string;
  /** Feature + checkout.sync_bill — when false, hide entry. */
  enabled: boolean;
  /**
   * Host bumps when the checkout bill may have changed (total / request / orders).
   * Triggers a one-shot GET for content_unchanged — not polling.
   */
  refreshKey: string;
  labels: Labels;
}) {
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<BillSyncJob | null>(null);
  const [available, setAvailable] = useState(input.enabled);
  /** Sole unlock gate from GET/POST — true only when live matches last succeeded sync. */
  const [contentUnchanged, setContentUnchanged] = useState(false);

  const refreshLatest = useCallback(async () => {
    if (!input.enabled) {
      setAvailable(false);
      setContentUnchanged(false);
      return null;
    }
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(input.restaurantSlug)}/bill-syncs?source_sale_id=${encodeURIComponent(input.billSplitId)}`,
      { credentials: 'include' },
    );
    if (res.status === 403) {
      setAvailable(false);
      setContentUnchanged(false);
      return null;
    }
    setAvailable(true);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      job?: BillSyncJob | null;
      content_unchanged?: boolean;
    };
    const next = data.job ?? null;
    setJob(next);
    setContentUnchanged(data.content_unchanged === true);
    return next;
  }, [input.billSplitId, input.enabled, input.restaurantSlug]);

  useEffect(() => {
    setJob(null);
    setContentUnchanged(false);
  }, [input.billSplitId]);

  useEffect(() => {
    void refreshLatest();
  }, [refreshLatest, input.refreshKey]);

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
  const syncBillBlocked = Boolean(busy || inFlight || contentUnchanged);

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
        setContentUnchanged(true);
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
    billSyncContentUnchanged: contentUnchanged,
    billSyncJob: job,
    syncBill,
  };
}
