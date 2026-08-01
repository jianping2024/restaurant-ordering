import { PrintAgentDevicesPanel } from '@/components/dashboard/PrintAgentDevicesPanel';
import { PrintAgentPairingPanel } from '@/components/dashboard/PrintAgentPairingPanel';
import { PrintAgentCredentialExpiryAlert } from '@/components/dashboard/PrintAgentCredentialExpiryAlert';
import { PrintJobsQueuePanel } from '@/components/dashboard/PrintJobsQueuePanel';
import { devicesNeedingRenewal } from '@/lib/print-agent-credential-expiry';
import { getPrintAgentVersion } from '@/lib/print-agent-download';
import { loadPrintAssistantUpperData } from '@/lib/print-assistant-page-data';

export async function PrintAssistantUpperSection({
  restaurantId,
  siteOrigin,
}: {
  restaurantId: string;
  siteOrigin: string;
}) {
  const upper = await loadPrintAssistantUpperData(restaurantId);
  const expiringDevices = devicesNeedingRenewal(upper.devices);
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
      <PrintJobsQueuePanel initialJobs={upper.recentJobs} />
      <PrintAgentPairingPanel initialPairings={upper.pairings} siteOrigin={siteOrigin} />
    </div>
  );
}
