'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { showToast } from '@/components/ui/Toast';
import {
  CheckoutPrintChoiceDialog,
  type CheckoutPrintAsk,
} from '@/components/dashboard/checkout/CheckoutPrintChoiceDialog';
import { billSyncByItemScopeId } from '@/lib/bill-sync-scope-id';
import { getMessages } from '@/lib/i18n/messages';
import { runStaffPrintFiscalInvoice } from '@/lib/run-staff-print-fiscal-invoice';
import { useStaffCheckoutBillPrint } from '@/lib/use-staff-checkout-bill-print';

type Props = {
  ask: CheckoutPrintAsk | null;
  restaurantSlug: string;
  onDone: (ask: CheckoutPrintAsk) => void;
};

/** Sole post-payment print question. Stays mounted after the checkout row leaves the queue. */
export function CheckoutPrintAskController({ ask, restaurantSlug, onDone }: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const [busy, setBusy] = useState(false);
  const { printSplitReceipt } = useStaffCheckoutBillPrint(restaurantSlug);

  const answer = async (yes: boolean) => {
    if (!ask || busy) return;
    setBusy(true);
    try {
      if (ask.fiscal) {
        if (!yes) return;
        const outcome = await runStaffPrintFiscalInvoice({
          restaurantSlug,
          billSplitId: ask.billSplitId,
          paymentMethod: ask.paymentMethod,
          paymentLines: ask.payment_lines,
          amount: ask.obligation,
          customerNif: ask.customerNif,
          customerName: ask.customerName,
          issueScopeId: ask.wholeTable
            ? undefined
            : billSyncByItemScopeId(ask.billSplitId, ask.personName),
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
        ask.paymentMethod === 'CASH' && ask.cashTendered != null
          ? ask.cashTendered
          : ask.obligation;
      await printSplitReceipt(
        {
          id: ask.billSplitId,
          session_id: ask.sessionId,
          table_id: ask.tableId,
          discount_rate: ask.discountRate,
        },
        ask.collection,
        {
          amountPaid,
          receiptVariant: ask.wholeTable ? 'final' : 'split_payment',
        },
      );
    } finally {
      setBusy(false);
      onDone(ask);
    }
  };

  return (
    <CheckoutPrintChoiceDialog
      open={ask != null}
      title={ask?.fiscal ? t.printInvoiceAskTitle : t.printBillAskTitle}
      yesLabel={t.printChoiceYes}
      noLabel={t.printChoiceNo}
      busy={busy}
      onYes={() => {
        void answer(true);
      }}
      onNo={() => {
        void answer(false);
      }}
    />
  );
}
