import { PrintAssistantDeferredPanels } from '@/components/dashboard/PrintAssistantDeferredPanels';
import { loadPrintAssistantLowerData } from '@/lib/print-assistant-page-data';
import type { UILanguage } from '@/lib/i18n';

type Props = {
  restaurantId: string;
  restaurantSlug: string;
  lang: UILanguage;
};

export async function PrintAssistantLowerSection({
  restaurantId,
  restaurantSlug,
  lang,
}: Props) {
  const lower = await loadPrintAssistantLowerData(restaurantId, lang);

  return (
    <PrintAssistantDeferredPanels
      restaurantSlug={restaurantSlug}
      defaultReceiptStationId={lower.defaultReceiptStationId}
      receiptPrinters={lower.receiptPrinters}
      scheduleForm={lower.scheduleForm}
    />
  );
}
