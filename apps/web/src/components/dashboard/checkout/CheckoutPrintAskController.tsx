'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { showToast } from '@/components/ui/Toast';
import {
  CheckoutPrintChoiceDialog,
  type CheckoutPrintAsk,
} from '@/components/dashboard/checkout/CheckoutPrintChoiceDialog';
import { billSyncByItemScopeId } from '@/lib/bill-sync-scope-id';
import { claimCheckoutPrintAskAutoIssue } from '@/lib/checkout-print-ask';
import { getMessages } from '@/lib/i18n/messages';
import { runStaffPrintFiscalInvoice } from '@/lib/run-staff-print-fiscal-invoice';
import { useStaffCheckoutBillPrint } from '@/lib/use-staff-checkout-bill-print';

type Props = {
  ask: CheckoutPrintAsk | null;
  restaurantSlug: string;
  onDone: (ask: CheckoutPrintAsk) => void;
};

/** Sole post-payment print question (or auto fiscal issue). Stays mounted after the queue row leaves. */
export function CheckoutPrintAskController({ ask, restaurantSlug, onDone }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const { printSplitReceipt } = useStaffCheckoutBillPrint(restaurantSlug);

  const answer = async (yes: boolean, forAsk: CheckoutPrintAsk) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (forAsk.fiscal) {
        if (!yes) return;
        const outcome = await runStaffPrintFiscalInvoice({
          restaurantSlug,
          billSplitId: forAsk.billSplitId,
          paymentMethod: forAsk.paymentMethod,
          paymentLines: forAsk.payment_lines,
          amount: forAsk.obligation,
          customerNif: forAsk.customerNif,
          customerName: forAsk.customerName,
          issueScopeId: forAsk.wholeTable
            ? undefined
            : billSyncByItemScopeId(
                forAsk.billSplitId,
                forAsk.personName,
                forAsk.partyId,
              ),
        });
        if (!outcome.ok) {
          showToast(outcome.message || t.printInvoiceFailed, 'error');
        } else {
          const no = outcome.invoiceNo ? ` ${outcome.invoiceNo}` : '';
          showToast(`${t.printInvoiceSuccess}${no}`, 'success');
        }
        return;
      }
      if (!yes) return;
      const amountPaid =
        forAsk.paymentMethod === 'CASH' && forAsk.cashTendered != null
          ? forAsk.cashTendered
          : forAsk.obligation;
      await printSplitReceipt(
        {
          id: forAsk.billSplitId,
          session_id: forAsk.sessionId,
          table_id: forAsk.tableId,
          discount_rate: forAsk.discountRate,
        },
        forAsk.collection,
        {
          amountPaid,
          receiptVariant: forAsk.wholeTable ? 'final' : 'split_payment',
        },
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      onDone(forAsk);
    }
  };

  const autoIssue = Boolean(ask?.autoIssueFiscal);

  useEffect(() => {
    if (!ask?.autoIssueFiscal) return;
    if (!claimCheckoutPrintAskAutoIssue(ask.collection.id)) return;
    void answer(true, ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per stamped ask
  }, [ask]);

  return (
    <CheckoutPrintChoiceDialog
      open={ask != null && !autoIssue}
      title={ask?.fiscal ? t.printInvoiceAskTitle : t.printBillAskTitle}
      yesLabel={t.printChoiceYes}
      noLabel={t.printChoiceNo}
      busy={busy}
      onYes={() => {
        if (!ask) return;
        void answer(true, ask);
      }}
      onNo={() => {
        if (!ask) return;
        void answer(false, ask);
      }}
    />
  );
}
