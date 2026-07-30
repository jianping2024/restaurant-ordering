import type { DashboardShellMode } from '@/lib/dashboard-access';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import type { StaffRole } from '@/lib/staff-account';

/** Roles shown in sticky product top bars (dashboard + staff shells). */
export type TopBarActorRole = StaffRole | 'backend_admin';

export function topBarRoleLabel(lang: UILanguage, role: TopBarActorRole): string {
  const t = getMessages(lang).staffSettings;
  switch (role) {
    case 'backend_admin':
      return t.roleBackendAdmin;
    case 'owner':
      return t.roleOwner;
    case 'kitchen':
      return t.roleKitchen;
    case 'waiter':
      return t.roleWaiter;
    case 'cashier':
      return t.roleCashier;
    case 'frontdesk':
      return t.roleFrontdesk;
  }
}

export function dashboardShellRoleLabel(
  lang: UILanguage,
  shellMode: DashboardShellMode,
  roleName?: string,
): string {
  if (shellMode === 'owner') return topBarRoleLabel(lang, 'backend_admin');
  if (roleName?.trim()) return roleName.trim();
  return topBarRoleLabel(lang, 'waiter');
}
