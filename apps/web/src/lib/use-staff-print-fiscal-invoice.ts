'use client';

import { useCallback, useState } from 'react';
import { showToast } from '@/components/ui/Toast';
import { runStaffPrintFiscalInvoice } from '@/lib/run-staff-print-fiscal-invoice';

type Labels = {
  printInvoiceSuccess: string;
  printInvoiceFailed: string;
  printInvoiceDisabled: string;
};

/**
 * Sole checkout/history hook for Farvoo「打印发票」(auto_issue enqueue + wait).
 */
export function useStaffPrintFiscalInvoice(input: {
  restaurantSlug: string;
  billSplitId: string;
  /** Feature + mayFiscalBillQueue — when false, hide entry. */
  enabled: boolean;
  labels: Labels;
}) {
  const [busy, setBusy] = useState(false);

  const printFiscalInvoice = useCallback(
    async (opts: {
      paymentMethod: string;
      customerNif?: string;
      customerName?: string;
      issueScopeId?: string;
    }) => {
      if (!input.enabled || busy) return;
      setBusy(true);
      try {
        const outcome = await runStaffPrintFiscalInvoice({
          restaurantSlug: input.restaurantSlug,
          billSplitId: input.billSplitId,
          paymentMethod: opts.paymentMethod,
          customerNif: opts.customerNif,
          customerName: opts.customerName,
          issueScopeId: opts.issueScopeId,
        });
        if (!outcome.ok) {
          if (outcome.code === 'bill_sync_disabled' || outcome.code === 'forbidden') {
            showToast(input.labels.printInvoiceDisabled, 'error');
            return;
          }
          showToast(
            outcome.message || outcome.job?.error_message || input.labels.printInvoiceFailed,
            'error',
          );
          return;
        }
        const no = outcome.invoiceNo ? ` ${outcome.invoiceNo}` : '';
        showToast(`${input.labels.printInvoiceSuccess}${no}`, 'success');
      } catch {
        showToast(input.labels.printInvoiceFailed, 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, input],
  );

  return {
    printFiscalInvoiceAvailable: input.enabled,
    printFiscalInvoiceBusy: busy,
    printFiscalInvoice,
  };
}
