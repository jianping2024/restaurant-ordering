import { isOnPremInstallHost } from '@/lib/license-on-prem-host';

/**
 * Sole host gate for operation logs page/API/nav/purge.
 * Cloud SaaS default off; on-prem pack sets MESA_ON_PREM=1.
 */
export function isOperationLogsHostEnabled(): boolean {
  return isOnPremInstallHost();
}
