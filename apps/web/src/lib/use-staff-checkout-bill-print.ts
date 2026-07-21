'use client';

import { useCallback, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { showToast } from '@/components/ui/Toast';
import { getMessages } from '@/lib/i18n/messages';
import {
  requestStaffCheckoutBillPrint,
  type StaffCheckoutBillPrintTarget,
} from '@/lib/staff-checkout-bill-print';
import { requestStaffSplitReceiptPrint } from '@/lib/staff-split-receipt-print';
import { requestStaffSessionPreBillPrint } from '@/lib/staff-session-bill-print';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { useStaffReceiptPrintCooldown } from '@/lib/use-checkout-bill-print-cooldown';

export function staffBillPrintCooldownKey(billSplitId: string): string {
  return `bill:${billSplitId}`;
}

export function staffSplitReceiptCooldownKey(billSplitId: string, personIndex: number): string {
  return `split:${billSplitId}:${personIndex}`;
}

export function staffSessionPreBillCooldownKey(sessionId: string): string {
  return `pre_bill:${sessionId}`;
}

function useStaffReceiptPrintRunner(restaurantSlug: string) {
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const { cooldownSecondsLeft, isOnCooldown, startCooldown } = useStaffReceiptPrintCooldown();
  const [printingKeys, setPrintingKeys] = useState<Set<string>>(() => new Set());

  const isPrintingKey = useCallback(
    (cooldownKey: string) => printingKeys.has(cooldownKey),
    [printingKeys],
  );

  const runStaffPrint = useCallback(
    async (cooldownKey: string, request: () => Promise<{ ok: boolean; skipped?: boolean }>) => {
      if (!restaurantSlug) {
        showToast(t.printBillFailed, 'error');
        return false;
      }
      if (isOnCooldown(cooldownKey)) {
        showToast(
          t.printBillCooldown.replace('{n}', String(cooldownSecondsLeft(cooldownKey))),
          'error',
        );
        return false;
      }

      setPrintingKeys((prev) => new Set(prev).add(cooldownKey));
      try {
        const outcome = await request();
        if (!outcome.ok) {
          showToast(t.printBillFailed, 'error');
          return false;
        }
        if (outcome.skipped) {
          showToast(t.printBillSkipped, 'error');
          return false;
        }

        startCooldown(cooldownKey);
        showToast(t.printBillSuccess, 'success');
        return true;
      } catch {
        showToast(t.printBillFailed, 'error');
        return false;
      } finally {
        setPrintingKeys((prev) => {
          const next = new Set(prev);
          next.delete(cooldownKey);
          return next;
        });
      }
    },
    [cooldownSecondsLeft, isOnCooldown, restaurantSlug, startCooldown, t],
  );

  return {
    t,
    runStaffPrint,
    isPrintingKey,
    cooldownSecondsLeft,
    isOnCooldown,
  };
}

export function useStaffCheckoutBillPrint(restaurantSlug: string) {
  const { t, runStaffPrint, isPrintingKey, cooldownSecondsLeft, isOnCooldown } =
    useStaffReceiptPrintRunner(restaurantSlug);

  const isPrintBillBusy = useCallback(
    (billSplitId: string) => isPrintingKey(staffBillPrintCooldownKey(billSplitId)),
    [isPrintingKey],
  );

  const isPrintReceiptBusy = useCallback(
    (billSplitId: string, personIndex: number) =>
      isPrintingKey(staffSplitReceiptCooldownKey(billSplitId, personIndex)),
    [isPrintingKey],
  );

  const printCheckoutBill = useCallback(
    async (billSplit: StaffCheckoutBillPrintTarget, discountRate?: number) => {
      const cooldownKey = staffBillPrintCooldownKey(billSplit.id);
      return runStaffPrint(cooldownKey, () =>
        requestStaffCheckoutBillPrint({ slug: restaurantSlug, billSplit, discountRate }),
      );
    },
    [restaurantSlug, runStaffPrint],
  );

  const printSplitReceipt = useCallback(
    async (billSplit: StaffCheckoutBillPrintTarget, payment: SessionCollectedPayment) => {
      if (payment.person_index == null || payment.person_index < 0) {
        showToast(t.printBillFailed, 'error');
        return false;
      }
      const cooldownKey = staffSplitReceiptCooldownKey(billSplit.id, payment.person_index);
      return runStaffPrint(cooldownKey, () =>
        requestStaffSplitReceiptPrint({ slug: restaurantSlug, billSplit, payment }),
      );
    },
    [restaurantSlug, runStaffPrint, t],
  );

  return {
    printCheckoutBill,
    printSplitReceipt,
    isPrintBillBusy,
    isPrintReceiptBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  };
}

/** Frontdesk ordered-items: manual session pre_bill with same cooldown UX as checkout「打印账单」. */
export function useStaffSessionPreBillPrint(restaurantSlug: string) {
  const { runStaffPrint, isPrintingKey, cooldownSecondsLeft, isOnCooldown } =
    useStaffReceiptPrintRunner(restaurantSlug);

  const isPrintPreBillBusy = useCallback(
    (sessionId: string) => isPrintingKey(staffSessionPreBillCooldownKey(sessionId)),
    [isPrintingKey],
  );

  const printSessionPreBill = useCallback(
    async (tableId: string, sessionId: string) => {
      const cooldownKey = staffSessionPreBillCooldownKey(sessionId);
      return runStaffPrint(cooldownKey, () =>
        requestStaffSessionPreBillPrint({ slug: restaurantSlug, tableId, sessionId }),
      );
    },
    [restaurantSlug, runStaffPrint],
  );

  return {
    printSessionPreBill,
    isPrintPreBillBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  };
}
