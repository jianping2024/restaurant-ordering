import { PrintAgentDevicesPanel } from '@/components/dashboard/PrintAgentDevicesPanel';
import { PrintAgentPairingPanel } from '@/components/dashboard/PrintAgentPairingPanel';
import { PrintAgentCredentialExpiryAlert } from '@/components/dashboard/PrintAgentCredentialExpiryAlert';
import { getPrintAgentDevicesNeedingRenewal } from '@/lib/print-agent-devices-server';
import { getPrintAgentVersion } from '@/lib/print-agent-download';
import { loadPrintAssistantUpperData } from '@/lib/print-assistant-page-data';

export async function PrintAssistantUpperSection({ restaurantId }: { restaurantId: string }) {
  const [upper, expiringDevices] = await Promise.all([
    loadPrintAssistantUpperData(restaurantId),
    getPrintAgentDevicesNeedingRenewal(restaurantId),
  ]);
  const printAgentVersion = getPrintAgentVersion();

  return (
    <div className="space-y-6">
      {expiringDevices.length > 0 ? (
        <PrintAgentCredentialExpiryAlert devices={expiringDevices} variant="panel" />
      ) : null}
      <PrintAgentDevicesPanel
        initialDevices={upper.devices}
        recommendedVersion={printAgentVersion || ''}
      />
      <PrintAgentPairingPanel initialPairings={upper.pairings} />
    </div>
  );
}
