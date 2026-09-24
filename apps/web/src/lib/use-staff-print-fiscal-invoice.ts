'use client';

import { useCallback, useState } from 'react';
import { showToast } from '@/components/ui/Toast';
import {
  fetchIssuedFiscalDocumentForPrint,
  runStaffPrintFiscalInvoice,
  runStaffReprintFiscalInvoice,
} from '@/lib/run-staff-print-fiscal-invoice';

type Labels = {
  printInvoiceSuccess: string;
  printInvoiceFailed: string;
  printInvoiceDisabled: string;
};

/**
 * Sole checkout/history hook for Farvoo「打印发票」:
 * same button → reprint if issued, else caller opens issue modal.
 */
export function useStaffPrintFiscalInvoice(input: {
  restaurantSlug: string;
  billSplitId: string;
  /** Feature + mayFiscalBillQueue — when false, hide entry. */
  enabled: boolean;
  labels: Labels;
}) {
  const [busy, setBusy] = useState(false);

  const toastOutcome = useCallback(
    (outcome: Awaited<ReturnType<typeof runStaffPrintFiscalInvoice>>) => {
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
    },
    [input.labels],
  );

  /**
   * Sole click entry for 「打印发票」.
   * Returns `issued` when cloud already has document_id → reprint started (no modal).
   * Returns `need_issue` when caller must open PrintFiscalInvoiceModal.
   */
  const requestPrintFiscalInvoice = useCallback(
    async (opts?: { issueScopeId?: string }): Promise<'reprinted' | 'need_issue' | 'busy'> => {
      if (!input.enabled) return 'need_issue';
      if (busy) return 'busy';
      setBusy(true);
      try {
        const issued = await fetchIssuedFiscalDocumentForPrint({
          restaurantSlug: input.restaurantSlug,
          billSplitId: input.billSplitId,
          issueScopeId: opts?.issueScopeId,
        });
        if (issued) {
          const outcome = await runStaffReprintFiscalInvoice({
            restaurantSlug: input.restaurantSlug,
            billSplitId: input.billSplitId,
            documentId: issued.documentId,
            issueScopeId: opts?.issueScopeId,
          });
          toastOutcome(outcome);
          return 'reprinted';
        }
        return 'need_issue';
      } catch {
        showToast(input.labels.printInvoiceFailed, 'error');
        return 'need_issue';
      } finally {
        setBusy(false);
      }
    },
    [busy, input, toastOutcome],
  );

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
        toastOutcome(outcome);
      } catch {
        showToast(input.labels.printInvoiceFailed, 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, input, toastOutcome],
  );

  return {
    printFiscalInvoiceAvailable: input.enabled,
    printFiscalInvoiceBusy: busy,
    requestPrintFiscalInvoice,
    printFiscalInvoice,
  };
}
