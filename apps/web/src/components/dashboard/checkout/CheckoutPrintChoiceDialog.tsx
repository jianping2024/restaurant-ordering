'use client';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { BillSyncPaymentMethod } from '@/lib/bill-sync-payload';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';

/** Survives the queue row leaving after the last payment. */
export type CheckoutPrintAsk = {
  billSplitId: string;
  sessionId: string;
  tableId: string;
  discountRate: number;
  fiscal: boolean;
  wholeTable: boolean;
  /** When true, queue should drop the row after the staff answers. */
  allPaid: boolean;
  personName: string;
  /** Atomic by-item ticket id when present — prefer for fiscal scope_id. */
  partyId?: string;
  obligation: number;
  paymentMethod: BillSyncPaymentMethod;
  payment_lines?: import('@/lib/bill-sync-payload').BillSyncPaymentLine[];
  customerNif: string;
  customerName: string;
  cashTendered: number | null;
  collection: SessionCollectedPayment;
  /**
   * Stamped once when the ask is built via {@link shouldAutoIssueFiscalAfterCollect}.
   * Controller skips the choice dialog and issues fiscal when true.
   */
  autoIssueFiscal: boolean;
};

type Props = {
  open: boolean;
  title: string;
  yesLabel: string;
  noLabel: string;
  busy?: boolean;
  onYes: () => void;
  onNo: () => void;
};

/** Post-payment print question. Backdrop does not dismiss; yes and no are the only exits. */
export function CheckoutPrintChoiceDialog({
  open,
  title,
  yesLabel,
  noLabel,
  busy = false,
  onYes,
  onNo,
}: Props) {
  return (
    <Modal open={open} onClose={() => {}} title={undefined} size="sm" dismissOnBackdrop={false}>
      <div className="space-y-4">
        <p className="text-base font-semibold text-brand-text">{title}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onNo} disabled={busy}>
            {noLabel}
          </Button>
          <Button type="button" variant="gold" size="sm" onClick={onYes} loading={busy} disabled={busy}>
            {yesLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
