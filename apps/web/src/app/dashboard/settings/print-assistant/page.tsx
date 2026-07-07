import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { PrintAgentCredentialExpiryAlert } from '@/components/dashboard/PrintAgentCredentialExpiryAlert';
import { PrintAgentDevicesPanel } from '@/components/dashboard/PrintAgentDevicesPanel';
import { PrintAgentPairingPanel } from '@/components/dashboard/PrintAgentPairingPanel';
import { PrintAgentSchedulePanel } from '@/components/dashboard/PrintAgentSchedulePanel';
import {
  PrintAgentDownloadSection,
  PrintAgentDownloadSkeleton,
} from '@/components/dashboard/PrintAgentDownloadSection';
import { ReceiptBillPrinterPanel } from '@/components/dashboard/ReceiptBillPrinterPanel';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { getPrintAgentDevicesNeedingRenewal } from '@/lib/print-agent-devices-server';
import { getPrintAgentVersion } from '@/lib/print-agent-download';
import { getServerLanguage } from '@/lib/i18n.server';
import { loadPrintAssistantPageData } from '@/lib/print-assistant-page-data';
import { getSiteOrigin } from '@/lib/site-origin';

export default async function PrintAssistantSettingsPage() {
  const access = await getDashboardAccess();
  if (access.mode === 'unauthenticated') redirect('/auth/login');
  if (access.mode === 'onboarding' || access.mode === 'access_error') redirect('/dashboard');

  const restaurant = access.restaurant;
  const lang = getServerLanguage();
  const [pageData, expiringDevices] = await Promise.all([
    loadPrintAssistantPageData(restaurant.id, lang),
    getPrintAgentDevicesNeedingRenewal(restaurant.id),
  ]);

  const siteOrigin = getSiteOrigin();
  const printAgentVersion = getPrintAgentVersion();

  return (
    <div className="space-y-6">
      {expiringDevices.length > 0 ? (
        <PrintAgentCredentialExpiryAlert devices={expiringDevices} variant="panel" />
      ) : null}
      <PrintAgentDevicesPanel
        initialDevices={pageData.devices}
        recommendedVersion={printAgentVersion || ''}
      />
      <ReceiptBillPrinterPanel
        restaurantSlug={restaurant.slug}
        initialDefaultReceiptStationId={pageData.defaultReceiptStationId}
        initialPrinters={pageData.receiptPrinters}
      />
      <PrintAgentPairingPanel initialPairings={pageData.pairings} />
      {siteOrigin ? (
        <Suspense fallback={<PrintAgentDownloadSkeleton />}>
          <PrintAgentDownloadSection siteOrigin={siteOrigin} />
        </Suspense>
      ) : null}
      <PrintAgentSchedulePanel initialForm={pageData.scheduleForm} />
    </div>
  );
}
