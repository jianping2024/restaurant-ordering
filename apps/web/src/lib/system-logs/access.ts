import { isOnPremInstallHost } from '@/lib/license-on-prem-host';
import type { Principal } from '@/lib/permissions/types';

/**
 * Sole gate for system log page/API: local-perm host + backend admin (owner_id).
 * Not a grantable PermissionKey — staff roles cannot obtain this.
 */
export function canAccessSystemLogs(principal: Principal | null | undefined): boolean {
  return Boolean(isOnPremInstallHost() && principal?.kind === 'owner');
}
