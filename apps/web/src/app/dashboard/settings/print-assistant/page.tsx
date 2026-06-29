import { createAdminClient } from '@/lib/supabase/admin';
import {
  cloudConfigToForm,
  defaultPrintAgentCloudConfig,
  normalizePrintAgentCloudConfig,
} from '@/lib/print-agent-config';
import { PrintAgentDownloadPanel } from '@/components/dashboard/PrintAgentDownloadPanel';
import {
  findLatestPublishedPrintAgentRelease,
  getPrintAgentDownloadUrls,
  getPrintAgentVersion,
  isPinnedPrintAgentReleaseAvailable,
} from '@/lib/print-agent-download';
import { getSiteOrigin } from '@/lib/site-origin';
import { PrintAgentPairingPanel } from '@/components/dashboard/PrintAgentPairingPanel';
import { PrintAgentSchedulePanel } from '@/components/dashboard/PrintAgentSchedulePanel';
import { PrintAgentCredentialExpiryAlert } from '@/components/dashboard/PrintAgentCredentialExpiryAlert';
import { PrintAgentDevicesPanel } from '@/components/dashboard/PrintAgentDevicesPanel';
import { ReceiptBillPrinterPanel } from '@/components/dashboard/ReceiptBillPrinterPanel';
import {
  loadPrintAgentDevices,
  loadPrintAgentDevicesNeedingRenewal,
} from '@/lib/print-agent-devices-server';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { redirect } from 'next/navigation';

export default async function PrintAssistantSettingsPage() {
  const access = await loadDashboardAccess();
  if (access.mode === 'unauthenticated') redirect('/auth/login');
  if (access.mode === 'onboarding' || access.mode === 'access_error') redirect('/dashboard');

  const restaurant = access.restaurant;
  const rid = restaurant.id;

  let initialScheduleForm = cloudConfigToForm(defaultPrintAgentCloudConfig());
  let initialDefaultReceiptStationId = '';
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('restaurants')
      .select('print_agent_config')
      .eq('id', rid)
      .single();
    const raw = row?.print_agent_config;
    if (raw && typeof raw === 'object' && Object.keys(raw as object).length > 0) {
      const config = normalizePrintAgentCloudConfig(raw);
      initialScheduleForm = cloudConfigToForm(config);
      initialDefaultReceiptStationId = config.default_receipt_station_id || '';
    }
  } catch {
    /* use defaults */
  }

  const siteOrigin = getSiteOrigin();
  const downloadUrls = siteOrigin ? getPrintAgentDownloadUrls(siteOrigin) : null;
  const printAgentVersion = getPrintAgentVersion();
  const downloadReleaseReady = printAgentVersion
    ? await isPinnedPrintAgentReleaseAvailable('setup-amd64')
    : true;
  const publishedFallback = !downloadReleaseReady
    ? await findLatestPublishedPrintAgentRelease()
    : null;

  const [expiringDevices, pairedDevices] = await Promise.all([
    loadPrintAgentDevicesNeedingRenewal(rid),
    loadPrintAgentDevices(rid),
  ]);

  return (
    <div className="space-y-6">
      {expiringDevices.length > 0 ? (
        <PrintAgentCredentialExpiryAlert devices={expiringDevices} variant="panel" />
      ) : null}
      <PrintAgentDevicesPanel
        initialDevices={pairedDevices}
        recommendedVersion={printAgentVersion || ''}
      />
      <ReceiptBillPrinterPanel
        restaurantSlug={restaurant.slug}
        initialDefaultReceiptStationId={initialDefaultReceiptStationId}
      />
      <PrintAgentPairingPanel />
      {downloadUrls ? (
        <PrintAgentDownloadPanel
          urls={downloadUrls}
          version={printAgentVersion}
          releaseReady={downloadReleaseReady}
          publishedFallback={publishedFallback}
        />
      ) : null}
      <PrintAgentSchedulePanel initialForm={initialScheduleForm} />
    </div>
  );
}
