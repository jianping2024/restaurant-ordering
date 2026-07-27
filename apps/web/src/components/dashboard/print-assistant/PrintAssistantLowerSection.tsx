import { Suspense } from 'react';
import { PrintAssistantDeferredPanels } from '@/components/dashboard/PrintAssistantDeferredPanels';
import {
  PrintAgentDownloadSection,
  PrintAgentDownloadSkeleton,
} from '@/components/dashboard/PrintAgentDownloadSection';
import { loadPrintAssistantLowerData } from '@/lib/print-assistant-page-data';
import type { UILanguage } from '@/lib/i18n';

type Props = {
  restaurantId: string;
  restaurantSlug: string;
  lang: UILanguage;
  siteOrigin: string;
};

export async function PrintAssistantLowerSection({
  restaurantId,
  restaurantSlug,
  lang,
  siteOrigin,
}: Props) {
  const lower = await loadPrintAssistantLowerData(restaurantId, lang);

  return (
    <div className="space-y-6">
      <Suspense fallback={<PrintAgentDownloadSkeleton />}>
        <PrintAgentDownloadSection siteOrigin={siteOrigin} />
      </Suspense>
      <PrintAssistantDeferredPanels
        restaurantSlug={restaurantSlug}
        defaultReceiptStationId={lower.defaultReceiptStationId}
        receiptPrinters={lower.receiptPrinters}
        scheduleForm={lower.scheduleForm}
      />
    </div>
  );
}
