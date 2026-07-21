'use client';

import dynamic from 'next/dynamic';
import type { PrintAgentSettingsForm } from '@/lib/print-agent-config';
import type { ReceiptPrinterOption } from '@/lib/print-receipt-printer-options';

const panelFallback = (
  <div className="h-32 animate-pulse rounded-xl border border-brand-border/40 bg-brand-card/60" />
);

const ReceiptBillPrinterPanel = dynamic(
  () =>
    import('@/components/dashboard/ReceiptBillPrinterPanel').then(
      (mod) => mod.ReceiptBillPrinterPanel,
    ),
  { loading: () => panelFallback },
);

const PrintAgentSchedulePanel = dynamic(
  () =>
    import('@/components/dashboard/PrintAgentSchedulePanel').then(
      (mod) => mod.PrintAgentSchedulePanel,
    ),
  { loading: () => panelFallback },
);

type Props = {
  restaurantSlug: string;
  defaultReceiptStationId: string | null;
  receiptPrinters: ReceiptPrinterOption[];
  scheduleForm: PrintAgentSettingsForm;
};

export function PrintAssistantDeferredPanels({
  restaurantSlug,
  defaultReceiptStationId,
  receiptPrinters,
  scheduleForm,
}: Props) {
  return (
    <>
      <ReceiptBillPrinterPanel
        restaurantSlug={restaurantSlug}
        initialDefaultReceiptStationId={defaultReceiptStationId ?? undefined}
        initialPrinters={receiptPrinters}
      />
      <PrintAgentSchedulePanel initialForm={scheduleForm} />
    </>
  );
}
