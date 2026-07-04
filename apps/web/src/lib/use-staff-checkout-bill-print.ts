'use client';

import { useCallback, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { showToast } from '@/components/ui/Toast';
import { getMessages } from '@/lib/i18n/messages';
import {
  requestStaffCheckoutBillPrint,
  type StaffCheckoutBillPrintTarget,
} from '@/lib/staff-checkout-bill-print';
import { useCheckoutBillPrintCooldown } from '@/lib/use-checkout-bill-print-cooldown';

export function useStaffCheckoutBillPrint(restaurantSlug: string) {
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const { cooldownSecondsLeft, isOnCooldown, startCooldown } = useCheckoutBillPrintCooldown();
  const [printingSplitIds, setPrintingSplitIds] = useState<Set<string>>(() => new Set());

  const isPrintBillBusy = useCallback(
    (billSplitId: string) => printingSplitIds.has(billSplitId),
    [printingSplitIds],
  );

  const printCheckoutBill = useCallback(
    async (billSplit: StaffCheckoutBillPrintTarget, discountRate?: number) => {
      if (!restaurantSlug) {
        showToast(t.printBillFailed, 'error');
        return false;
      }
      if (isOnCooldown(billSplit.id)) {
        showToast(
          t.printBillCooldown.replace('{n}', String(cooldownSecondsLeft(billSplit.id))),
          'error',
        );
        return false;
      }

      setPrintingSplitIds((prev) => new Set(prev).add(billSplit.id));
      try {
        const outcome = await requestStaffCheckoutBillPrint({
          slug: restaurantSlug,
          billSplit,
          discountRate,
        });

        if (!outcome.ok) {
          showToast(t.printBillFailed, 'error');
          return false;
        }
        if (outcome.skipped) {
          showToast(t.printBillSkipped, 'error');
          return false;
        }

        startCooldown(billSplit.id);
        showToast(t.printBillSuccess, 'success');
        return true;
      } catch {
        showToast(t.printBillFailed, 'error');
        return false;
      } finally {
        setPrintingSplitIds((prev) => {
          const next = new Set(prev);
          next.delete(billSplit.id);
          return next;
        });
      }
    },
    [cooldownSecondsLeft, isOnCooldown, restaurantSlug, startCooldown, t],
  );

  return {
    printCheckoutBill,
    isPrintBillBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  };
}
